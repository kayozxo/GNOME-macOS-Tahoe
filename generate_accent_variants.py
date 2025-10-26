#!/usr/bin/env python3
"""
GTK Theme Accent Color Generator
Automatically generates multiple accent color variants for GTK themes
without duplicating files manually.

Usage:
    python3 generate_accent_variants.py [--color HEX] [--name NAME] [--all]

Examples:
    python3 generate_accent_variants.py --color "#ff6b6b" --name "coral"
    python3 generate_accent_variants.py --all  # Generate all predefined colors
"""

import os
import re
import argparse
import colorsys
from pathlib import Path
from typing import Dict, List, Tuple, Optional

class ColorGenerator:
    """Generate accent color variants for GTK themes"""

    # Predefined color palettes
    COLOR_PALETTES = {
        'blue': '#3b82f6',
        'green': '#10b981',
        'purple': '#8b5cf6',
        'pink': '#ec4899',
        'orange': '#f59e0b',
        'red': '#ef4444',
        'teal': '#14b8a6',
        'indigo': '#6366f1',
        'rose': '#f43f5e',
        'emerald': '#059669',
        'violet': '#7c3aed',
        'amber': '#d97706',
        'cyan': '#06b6d4',
        'lime': '#84cc16',
        'sky': '#0ea5e9',
        'slate': '#64748b'
    }

    def __init__(self, theme_root: str):
        self.theme_root = Path(theme_root)
        self.dark_theme = self.theme_root / 'gtk' / 'Tahoe-Dark'
        self.light_theme = self.theme_root / 'gtk' / 'Tahoe-Light'

    def hex_to_rgb(self, hex_color: str) -> Tuple[int, int, int]:
        """Convert hex color to RGB tuple"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    def hex_to_rgb_string(self, hex_color: str, opacity: float = 1.0) -> str:
        """Convert hex color to RGB string with opacity"""
        rgb = self.hex_to_rgb(hex_color)
        return f'rgb({rgb[0]} {rgb[1]} {rgb[2]} / {int(opacity * 100)}%)'

    def rgb_to_hex(self, rgb: Tuple[int, int, int]) -> str:
        """Convert RGB tuple to hex color"""
        return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

    def adjust_color_brightness(self, hex_color: str, factor: float) -> str:
        """Adjust color brightness by factor (1.0 = no change, >1.0 = brighter, <1.0 = darker)"""
        rgb = self.hex_to_rgb(hex_color)
        hsv = colorsys.rgb_to_hsv(rgb[0]/255.0, rgb[1]/255.0, rgb[2]/255.0)
        new_v = min(1.0, hsv[2] * factor)
        new_rgb = colorsys.hsv_to_rgb(hsv[0], hsv[1], new_v)
        return self.rgb_to_hex((int(new_rgb[0]*255), int(new_rgb[1]*255), int(new_rgb[2]*255)))

    def generate_color_variants(self, base_color: str) -> Dict[str, str]:
        """Generate color variants for different UI states"""
        return {
            'base': base_color,
            'hover': self.adjust_color_brightness(base_color, 1.1),
            'active': self.adjust_color_brightness(base_color, 0.9),
            'light': self.adjust_color_brightness(base_color, 1.3),
            'dark': self.adjust_color_brightness(base_color, 0.7)
        }


    def create_accent_variant(self, color_name: str, base_color: str) -> None:
        """Create a complete accent color variant"""
        colors = self.generate_color_variants(base_color)

        # Create variant directories
        dark_variant = self.dark_theme.parent / f'Tahoe-Dark-{color_name.title()}'
        light_variant = self.light_theme.parent / f'Tahoe-Light-{color_name.title()}'

        # Copy base themes
        self._copy_theme_directory(self.dark_theme, dark_variant)
        self._copy_theme_directory(self.light_theme, light_variant)

        # Inject accent colors into GTK4 files
        self._inject_gtk4_colors(dark_variant / 'gtk-4.0' / 'gtk.css', colors)
        self._inject_gtk4_colors(light_variant / 'gtk-4.0' / 'gtk.css', colors)

        # Inject accent colors into GTK3 files
        self._inject_gtk3_colors(dark_variant / 'gtk-3.0' / 'gtk.css', colors)
        self._inject_gtk3_colors(light_variant / 'gtk-3.0' / 'gtk.css', colors)

        # Inject accent colors into GNOME Shell files
        self._inject_gnome_shell_colors(dark_variant / 'gnome-shell' / 'gnome-shell.css', colors)
        self._inject_gnome_shell_colors(light_variant / 'gnome-shell' / 'gnome-shell.css', colors)

        # Update index.theme files
        self._update_index_theme(dark_variant, f'Tahoe-Dark-{color_name.title()}')
        self._update_index_theme(light_variant, f'Tahoe-Light-{color_name.title()}')

        print(f"✅ Created accent variant: {color_name.title()}")
        print(f"   Dark: {dark_variant}")
        print(f"   Light: {light_variant}")

    def _copy_theme_directory(self, src: Path, dst: Path) -> None:
        """Copy theme directory recursively"""
        import shutil
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)

    def _inject_gtk4_colors(self, css_file: Path, colors: Dict[str, str]) -> None:
        """Inject accent colors into GTK4 CSS file"""
        if not css_file.exists():
            return

        import re

        with open(css_file, 'r') as f:
            content = f.read()

        base_color = colors['base']
        active_toggle_color = self.hex_to_rgb_string(base_color, 0.2)

        # Find the first :root block
        root_pattern = r'(:root\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})'
        root_match = re.search(root_pattern, content, re.DOTALL)

        if root_match:
            existing_root = root_match.group(0)
            brace_pos = existing_root.find('{')

            if brace_pos != -1:
                # Check if we already have these variables
                if '  --accent-bg-color:' not in existing_root:
                    # Insert variables right after opening brace
                    existing_root = existing_root[:brace_pos+1] + f'\n  --accent-bg-color: {base_color};\n  --accent-fg-color: white;\n  --active-toggle-bg-color: {active_toggle_color};' + existing_root[brace_pos+1:]
                else:
                    # Update existing variables
                    existing_root = re.sub(r'  --accent-bg-color:\s*[^;]+;', f'  --accent-bg-color: {base_color};', existing_root)
                    existing_root = re.sub(r'  --accent-fg-color:\s*[^;]+;', '  --accent-fg-color: white;', existing_root)
                    # Remove old and add new active-toggle-bg-color
                    existing_root = re.sub(r'\s*--active-toggle-bg-color:\s*[^;]+;', '', existing_root)
                    fg_color_pos = existing_root.find('--active-toggle-fg-color')
                    if fg_color_pos != -1:
                        existing_root = existing_root[:fg_color_pos] + f'  --active-toggle-bg-color: {active_toggle_color};\n' + existing_root[fg_color_pos:]

            content = content.replace(root_match.group(0), existing_root)
            content = re.sub(r'\s*--active-toggle-bg-color:\s*rgb\(255 255 255 / 20%\);', '', content)

        with open(css_file, 'w') as f:
            f.write(content)

    def _inject_gtk3_colors(self, css_file: Path, colors: Dict[str, str]) -> None:
        """Inject accent colors into GTK3 CSS file"""
        if not css_file.exists():
            return

        import re

        with open(css_file, 'r') as f:
            content = f.read()

        # Add GTK3 color definitions at the beginning
        gtk3_css = f"""/* GTK3 Accent Color Definitions */
@define-color accent_color {colors['base']};
@define-color accent_color_hover {colors['hover']};
@define-color accent_color_active {colors['active']};

/* Accent color applications */
switch:checked {{
  background-color: @accent_color;
}}

scale.horizontal > trough > highlight.top {{
  background-color: @accent_color;
}}

button.titlebutton.close {{
  background-color: @accent_color;
}}

button.titlebutton.close:hover {{
  background-color: @accent_color_hover;
}}

button.suggested-action {{
  background-color: @accent_color;
}}

button.suggested-action:hover {{
  background-color: @accent_color_hover;
}}

button.suggested-action:active {{
  background-color: @accent_color_active;
}}
"""

        content = gtk3_css + '\n' + content

        with open(css_file, 'w') as f:
            f.write(content)

    def _inject_gnome_shell_colors(self, css_file: Path, colors: Dict[str, str]) -> None:
        """Inject accent colors into GNOME Shell CSS file"""
        if not css_file.exists():
            return

        import re

        with open(css_file, 'r') as f:
            content = f.read()

        base_color = colors['base']
        hover_color = colors['hover']
        active_color = colors['active']

        # Replace hardcoded accent colors with the new color
        # Replace #0091ff (default blue) with the accent color
        content = re.sub(r'#0091ff', base_color, content)

        # Replace #3484e2 (lighter blue) with hover color
        content = re.sub(r'#3484e2', hover_color, content)

        # Replace any remaining hardcoded accent colors that might be variations
        # This handles cases where colors are mixed or modified
        content = re.sub(r'st-lighten\(#0091ff', f'st-lighten({base_color}', content)
        content = re.sub(r'st-darken\(#0091ff', f'st-darken({base_color}', content)
        content = re.sub(r'st-transparentize\(#0091ff', f'st-transparentize({base_color}', content)
        content = re.sub(r'st-mix\([^,]+,\s*#0091ff', f'st-mix(white, {base_color}', content)

        with open(css_file, 'w') as f:
            f.write(content)


    def _update_index_theme(self, theme_dir: Path, theme_name: str) -> None:
        """Update index.theme file with new theme name"""
        index_file = theme_dir / 'index.theme'
        if not index_file.exists():
            return

        with open(index_file, 'r') as f:
            content = f.read()

        # Replace theme name
        content = re.sub(r'Name=.*', f'Name={theme_name}', content)
        content = re.sub(r'GtkTheme=.*', f'GtkTheme={theme_name}', content)

        with open(index_file, 'w') as f:
            f.write(content)

    def generate_all_variants(self) -> None:
        """Generate all predefined color variants"""
        print("🎨 Generating all accent color variants...")
        for color_name, color_value in self.COLOR_PALETTES.items():
            self.create_accent_variant(color_name, color_value)
        print(f"\n✨ Generated {len(self.COLOR_PALETTES)} accent variants!")

def main():
    parser = argparse.ArgumentParser(description='Generate GTK theme accent color variants')
    parser.add_argument('--color', type=str, help='Hex color code (e.g., #ff6b6b) or color name (e.g., blue)')
    parser.add_argument('--name', type=str, help='Color variant name (e.g., coral)')
    parser.add_argument('--all', action='store_true', help='Generate all predefined colors')

    args = parser.parse_args()

    # Get theme root directory
    theme_root = Path(__file__).parent
    generator = ColorGenerator(str(theme_root))

    if args.all:
        generator.generate_all_variants()
    elif args.color and args.name:
        # Check if color is a predefined color name
        if args.color in generator.COLOR_PALETTES:
            actual_color = generator.COLOR_PALETTES[args.color]
            generator.create_accent_variant(args.name, actual_color)
        else:
            # Assume it's a hex color
            generator.create_accent_variant(args.name, args.color)
    else:
        print("Usage examples:")
        print("  python3 generate_accent_variants.py --color '#ff6b6b' --name 'coral'")
        print("  python3 generate_accent_variants.py --color 'blue' --name 'blue'")
        print("  python3 generate_accent_variants.py --all")
        print("\nAvailable predefined colors:")
        for name, color in generator.COLOR_PALETTES.items():
            print(f"  {name}: {color}")

if __name__ == '__main__':
    main()
