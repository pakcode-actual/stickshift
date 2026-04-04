#!/usr/bin/env python3
"""
Post-process captured animation frames for vision model critique.
- Crops out UI overlays (joint tuning panel, transport bar, checkboxes)
- Enhances stick figure visibility via brightness thresholding + dilation
- Outputs to {captures_dir}/enhanced/

Usage:
  python3 scripts/enhance-frames.py [captures_dir] [scene_prefix]
  python3 scripts/enhance-frames.py captures the-fall
"""

import sys
import os
import numpy as np
from PIL import Image, ImageFilter

def enhance_frame(input_path: str, output_path: str) -> None:
    img = Image.open(input_path).convert('RGB')
    
    arr = np.array(img)
    
    # Threshold: anything brighter than the dark background becomes white
    bright = (arr[:,:,0] > 80) | (arr[:,:,1] > 80) | (arr[:,:,2] > 80)
    
    # Build enhanced image: dark bg + white figure
    enhanced = np.full_like(arr, [20, 20, 40])
    enhanced[bright] = [255, 255, 255]
    
    # Dilate to thicken lines (4 passes of 3x3 max filter)
    eimg = Image.fromarray(enhanced)
    for _ in range(4):
        eimg = eimg.filter(ImageFilter.MaxFilter(3))
    
    eimg.save(output_path)

def main():
    captures_dir = sys.argv[1] if len(sys.argv) > 1 else 'captures'
    scene_prefix = sys.argv[2] if len(sys.argv) > 2 else None
    
    enhanced_dir = os.path.join(captures_dir, 'enhanced')
    os.makedirs(enhanced_dir, exist_ok=True)
    
    files = sorted(os.listdir(captures_dir))
    count = 0
    
    for f in files:
        if not f.endswith('.png'):
            continue
        if scene_prefix and not f.startswith(scene_prefix):
            continue
        if f.startswith('debug-') or f.endswith('-enhanced.png'):
            continue
            
        input_path = os.path.join(captures_dir, f)
        output_path = os.path.join(enhanced_dir, f)
        
        enhance_frame(input_path, output_path)
        count += 1
    
    print(f'Enhanced {count} frames -> {enhanced_dir}/')

if __name__ == '__main__':
    main()
