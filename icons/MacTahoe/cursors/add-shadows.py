#!/usr/bin/env python3

"""
Add subtle macOS-style drop shadows to cursor SVG files.
Applies shadow filter with 1.5px offset, 1px blur, 30% opacity.
"""

import os
import sys
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace('', SVG_NS)

def add_shadow_to_svg(svg_path):
    """Add shadow filter to an SVG file."""
    try:
        tree = ET.parse(svg_path)
        root = tree.getroot()

        # Check if the filter already exists
        for defs in root.findall(f".//{{{SVG_NS}}}defs"):
            for filt in defs.findall(f".//{{{SVG_NS}}}filter"):
                if filt.get('id') == 'shadow':
                    print(f"Shadow already exists in {os.path.basename(svg_path)}, skipping")
                    return False

        defs = root.find(f".//{{{SVG_NS}}}defs")
        if defs is None:
            defs = ET.Element('defs')
            root.insert(0, defs)

        # This creates a subtle macOS-style drop shadow:
        # - feGaussianBlur creates soft edge
        # - feOffset shifts shadow 1.5px down-right
        # - feComponentTransfer sets opacity to 30%
        # - feMerge composites shadow beneath original graphic
        shadow_filter = ET.SubElement(defs, 'filter', {
            'id': 'shadow',
            'x': '-50%',
            'y': '-50%',
            'width': '200%',
            'height': '200%'
        })

        # Blur the source alpha channel
        ET.SubElement(shadow_filter, 'feGaussianBlur', {
            'in': 'SourceAlpha',
            'stdDeviation': '1'
        })

        # Offset shadow 1.5px diagonal
        ET.SubElement(shadow_filter, 'feOffset', {
            'dx': '1.5',
            'dy': '1.5',
            'result': 'offsetblur'
        })

        # Set shadow opacity to 30%
        component_transfer = ET.SubElement(shadow_filter, 'feComponentTransfer')
        ET.SubElement(component_transfer, 'feFuncA', {
            'type': 'linear',
            'slope': '0.3'
        })

        # Composite shadow under original
        merge = ET.SubElement(shadow_filter, 'feMerge')
        ET.SubElement(merge, 'feMergeNode')  # Shadow (current result)
        ET.SubElement(merge, 'feMergeNode', {'in': 'SourceGraphic'})  # Original on top

        # Wrap all existing content in a group with the filter applied
        # This ensures shadow applies to all paths
        children = list(root)

        # Create group element
        g = ET.Element('g', {'filter': 'url(#shadow)'})

        # Move all non-defs children into the group
        for child in children:
            if child != defs:
                root.remove(child)
                g.append(child)

        # Add group to root
        root.append(g)

        # Write back with proper formatting
        tree.write(svg_path, encoding='unicode', xml_declaration=False)

        # Fix formatting: add newlines and proper XML declaration
        with open(svg_path, 'r') as f:
            content = f.read()

        # Add back the SVG structure (ElementTree removes it)
        if not content.startswith('<?xml'):
            content = content

        with open(svg_path, 'w') as f:
            f.write(content)

        return True

    except Exception as e:
        print(f"Error processing {os.path.basename(svg_path)}: {e}")
        return False

def process_directory(svg_dir):
    """Process all SVG files in a directory."""
    if not os.path.isdir(svg_dir):
        print(f"Directory not found: {svg_dir}")
        return

    svg_files = sorted([f for f in os.listdir(svg_dir) if f.endswith('.svg')])

    if not svg_files:
        print(f"No SVG files found in {svg_dir}")
        return

    print(f"\nProcessing {len(svg_files)} SVG files in {svg_dir}...")

    success_count = 0
    for svg_file in svg_files:
        svg_path = os.path.join(svg_dir, svg_file)
        if add_shadow_to_svg(svg_path):
            success_count += 1
            print(f"  ✓ {svg_file}")

    print(f"\nAdded shadows to {success_count}/{len(svg_files)} files")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 add_shadows.py <svg_directory> [<svg_directory2> ...]")
        sys.exit(1)

    for svg_dir in sys.argv[1:]:
        process_directory(svg_dir)
