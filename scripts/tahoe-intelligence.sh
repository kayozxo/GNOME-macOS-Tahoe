#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Tahoe Intelligence"
APP_ID="gnome-macos-tahoe"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/gnome-macos-tahoe"
ENV_FILE="$CONFIG_DIR/openai.env"
API_URL="${OPENAI_API_URL:-https://api.openai.com/v1/responses}"
MODEL="${OPENAI_MODEL:-gpt-5-mini}"
REASONING_EFFORT="${OPENAI_REASONING_EFFORT:-low}"
TEXT_VERBOSITY="${OPENAI_TEXT_VERBOSITY:-low}"

SYSTEM_PROMPT="You are Tahoe Intelligence, a concise desktop writing and productivity assistant inspired by Apple Intelligence. Help with rewriting, summarizing, explaining, drafting, and extracting action items. Be direct, polished, and privacy-conscious. If the user pasted selected text, operate on it without over-explaining."

COPY_OUTPUT=false
USE_CLIPBOARD=false
NO_GUI=false
PROMPT_ARGS=()

usage() {
  cat <<'TXT'
Tahoe Intelligence

Usage:
  tahoe-intelligence "rewrite this more clearly"
  wl-paste | tahoe-intelligence "summarize this"
  tahoe-intelligence --clipboard "make this friendlier"
  tahoe-intelligence --setup-key
  tahoe-intelligence --clear-key

Authentication:
  Uses OPENAI_API_KEY, then GNOME Keyring, then:
    ~/.config/gnome-macos-tahoe/openai.env

Options:
  --setup-key       Store an OpenAI API key for this user
  --clear-key       Remove the stored API key
  --clipboard       Use current clipboard text as context
  --copy            Copy the answer to the clipboard
  --no-gui          Print to the terminal instead of opening a dialog
  --model NAME      Override the model for this run
  -h, --help        Show this help

Environment:
  OPENAI_API_KEY              OpenAI API key
  OPENAI_MODEL                Model override (default: gpt-5-mini)
  OPENAI_REASONING_EFFORT     none, low, medium, high, xhigh (default: low)
  OPENAI_TEXT_VERBOSITY       low, medium, high (default: low)
TXT
}

have() {
  command -v "$1" >/dev/null 2>&1
}

note() {
  printf '%s\n' "$*" >&2
}

prompt_for_secret() {
  local prompt="${1:-OpenAI API key:}"
  local value=""

  if have gum; then
    value="$(gum input --password --placeholder "$prompt")"
  elif have zenity && { [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; }; then
    value="$(zenity --password --title "$APP_NAME" --text "$prompt" 2>/dev/null || true)"
  else
    printf '%s ' "$prompt" >&2
    IFS= read -r -s value
    printf '\n' >&2
  fi

  printf '%s' "$value"
}

store_key() {
  local key="$1"
  mkdir -p "$CONFIG_DIR"
  chmod 700 "$CONFIG_DIR"

  if have secret-tool; then
    printf '%s' "$key" | secret-tool store \
      --label="$APP_NAME OpenAI API key" \
      application "$APP_ID" credential openai-api-key
    note "Stored API key in GNOME Keyring."
    return 0
  fi

  umask 077
  printf 'OPENAI_API_KEY=%s\n' "$key" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  note "Stored API key in $ENV_FILE (mode 600)."
}

read_key_from_env_file() {
  [ -r "$ENV_FILE" ] || return 1
  awk -F= '$1 == "OPENAI_API_KEY" {print substr($0, index($0, "=") + 1)}' "$ENV_FILE" | tail -n1
}

get_key() {
  if [ -n "${OPENAI_API_KEY:-}" ]; then
    printf '%s' "$OPENAI_API_KEY"
    return 0
  fi

  if have secret-tool; then
    local key
    key="$(secret-tool lookup application "$APP_ID" credential openai-api-key 2>/dev/null || true)"
    if [ -n "$key" ]; then
      printf '%s' "$key"
      return 0
    fi
  fi

  local file_key
  file_key="$(read_key_from_env_file || true)"
  if [ -n "$file_key" ]; then
    printf '%s' "$file_key"
    return 0
  fi

  return 1
}

clear_key() {
  if have secret-tool; then
    secret-tool clear application "$APP_ID" credential openai-api-key >/dev/null 2>&1 || true
  fi
  rm -f "$ENV_FILE"
  note "Removed Tahoe Intelligence API key storage."
}

read_clipboard() {
  if have wl-paste; then
    wl-paste -n 2>/dev/null || true
  elif have xclip; then
    xclip -selection clipboard -o 2>/dev/null || true
  elif have xsel; then
    xsel --clipboard --output 2>/dev/null || true
  fi
}

copy_to_clipboard() {
  local text="$1"
  if have wl-copy; then
    printf '%s' "$text" | wl-copy
  elif have xclip; then
    printf '%s' "$text" | xclip -selection clipboard
  elif have xsel; then
    printf '%s' "$text" | xsel --clipboard --input
  else
    return 1
  fi
}

collect_prompt() {
  local prompt=""
  local clipboard_text=""

  if [ ${#PROMPT_ARGS[@]} -gt 0 ]; then
    prompt="${PROMPT_ARGS[*]}"
  elif [ ! -t 0 ]; then
    prompt="$(cat)"
  elif have zenity && [ "$NO_GUI" = false ] && { [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; }; then
    prompt="$(zenity --entry --title "$APP_NAME" --text "Ask Tahoe Intelligence:" --width 560 2>/dev/null || true)"
  else
    printf 'Ask Tahoe Intelligence: ' >&2
    IFS= read -r prompt
  fi

  if [ "$USE_CLIPBOARD" = true ]; then
    clipboard_text="$(read_clipboard)"
    if [ -n "$clipboard_text" ]; then
      prompt="${prompt}${prompt:+$'\n\n'}Selected text / clipboard:${clipboard_text:+$'\n'}$clipboard_text"
    fi
  fi

  printf '%s' "$prompt"
}

build_payload() {
  local prompt="$1"
  TAHOE_MODEL="$MODEL" \
  TAHOE_REASONING_EFFORT="$REASONING_EFFORT" \
  TAHOE_TEXT_VERBOSITY="$TEXT_VERBOSITY" \
  TAHOE_SYSTEM_PROMPT="$SYSTEM_PROMPT" \
  TAHOE_USER_PROMPT="$prompt" \
  python3 -c '
import json
import os

payload = {
    "model": os.environ["TAHOE_MODEL"],
    "input": [
        {"role": "developer", "content": os.environ["TAHOE_SYSTEM_PROMPT"]},
        {"role": "user", "content": os.environ["TAHOE_USER_PROMPT"]},
    ],
}
model = payload["model"]
if model.startswith("gpt-5") or model.startswith("o"):
    payload["reasoning"] = {"effort": os.environ["TAHOE_REASONING_EFFORT"]}
    payload["text"] = {"verbosity": os.environ["TAHOE_TEXT_VERBOSITY"]}
print(json.dumps(payload))
'
}

extract_output_text() {
  python3 -c '
import json
import sys

raw = sys.stdin.read()
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print(raw)
    sys.exit(0)

error = data.get("error")
if error:
    message = error.get("message") if isinstance(error, dict) else str(error)
    print(message or "OpenAI API request failed", file=sys.stderr)
    sys.exit(1)

text = data.get("output_text")
if text:
    print(text)
    sys.exit(0)

parts = []
for item in data.get("output", []):
    if not isinstance(item, dict):
        continue
    for content in item.get("content", []):
        if isinstance(content, dict) and content.get("type") == "output_text":
            parts.append(content.get("text", ""))

print("\n".join(part for part in parts if part).strip())
'
}

display_output() {
  local text="$1"

  if [ "$COPY_OUTPUT" = true ]; then
    copy_to_clipboard "$text" && note "Copied answer to clipboard." || note "No clipboard helper found; answer not copied."
  fi

  if [ "$NO_GUI" = false ] && have zenity && { [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; }; then
    local tmp
    tmp="$(mktemp -t tahoe-intelligence-output.XXXXXXXXXX)"
    printf '%s\n' "$text" > "$tmp"
    zenity --text-info --title "$APP_NAME" --width 760 --height 560 --filename "$tmp" 2>/dev/null || true
    rm -f "$tmp"
  else
    printf '%s\n' "$text"
  fi
}

run_request() {
  local prompt="$1"
  local api_key="$2"
  local payload response_file http_code response output

  payload="$(build_payload "$prompt")"
  response_file="$(mktemp -t tahoe-intelligence-response.XXXXXXXXXX)"

  http_code="$(curl -sS -o "$response_file" -w '%{http_code}' \
    "$API_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $api_key" \
    -d "$payload")"

  response="$(cat "$response_file")"
  rm -f "$response_file"

  if [[ ! "$http_code" =~ ^2 ]]; then
    printf '%s' "$response" | extract_output_text >&2 || true
    exit 1
  fi

  output="$(printf '%s' "$response" | extract_output_text)"
  if [ -z "$output" ]; then
    note "OpenAI returned no text output."
    exit 1
  fi

  display_output "$output"
}

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --setup-key)
      key="$(prompt_for_secret "Paste your OpenAI API key")"
      if [ -z "$key" ]; then
        note "No key entered."
        exit 1
      fi
      store_key "$key"
      exit 0
      ;;
    --clear-key)
      clear_key
      exit 0
      ;;
    --clipboard)
      USE_CLIPBOARD=true
      shift
      ;;
    --copy)
      COPY_OUTPUT=true
      shift
      ;;
    --no-gui)
      NO_GUI=true
      shift
      ;;
    --model)
      MODEL="${2:-}"
      if [ -z "$MODEL" ]; then
        note "--model requires a model name."
        exit 1
      fi
      shift 2
      ;;
    --)
      shift
      PROMPT_ARGS+=("$@")
      break
      ;;
    -*)
      note "Unknown option: $1"
      usage
      exit 1
      ;;
    *)
      PROMPT_ARGS+=("$1")
      shift
      ;;
  esac
done

if ! have curl || ! have python3; then
  note "curl and python3 are required."
  exit 1
fi

prompt="$(collect_prompt)"
if [ -z "$prompt" ]; then
  note "No prompt provided."
  exit 1
fi

api_key="$(get_key || true)"
if [ -z "$api_key" ]; then
  note "No OpenAI API key found."
  note "Run: tahoe-intelligence --setup-key"
  note "Or set: export OPENAI_API_KEY=\"your_api_key_here\""
  exit 1
fi

run_request "$prompt" "$api_key"
