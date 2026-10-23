"""Compare saved QA page content after the native harness resizes its JPEG.

This fixture check permits JPEG loss, records the differences, and checks every
tile as well as the complete image. It does not test a model's comprehension.
"""
import hashlib
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(sys.argv[1]) / 'artifact-python'))
from PIL import Image, ImageChops, ImageStat

source, native = map(Path, sys.argv[2:4])
with Image.open(source) as first, Image.open(native) as second:
    source_size, native_size = first.size, second.size
    quantization_changed = first.quantization != second.quantization
    assert second.format == first.format == 'JPEG'
    assert all(0 < b <= a for a, b in zip(source_size, native_size))
    assert abs(source_size[0] / source_size[1] - native_size[0] / native_size[1]) < 0.001
    reference = first.convert('RGB').resize(native_size, Image.Resampling.BILINEAR)
    actual = second.convert('RGB')
    difference = ImageChops.difference(reference, actual)
    stats = ImageStat.Stat(difference)
    mse = sum(value * value for value in stats.rms) / 3
    psnr = 10 * math.log10(255 * 255 / mse) if mse else None
    tiles = []
    width, height = native_size
    for row in range(8):
        for column in range(8):
            tile = difference.crop((column * width // 8, row * height // 8,
                                    (column + 1) * width // 8, (row + 1) * height // 8))
            tiles.append(max(ImageStat.Stat(tile).rms))
    # Conservative, fixed tolerances for this generated receipt fixture:
    # average channel error < 1/255, whole-page PSNR >= 40dB, all tiles < 10/255 RMS.
    assert max(stats.mean) < 1
    assert psnr is None or psnr >= 40
    assert max(tiles) < 10
    print(json.dumps({
        'success': True, 'sourceDimensions': source_size, 'nativeDimensions': native_size,
        'resized': source_size != native_size, 'jpegQuantizationChanged': quantization_changed,
        'sourceBytes': source.stat().st_size, 'nativeBytes': native.stat().st_size,
        'sourceJpegSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'nativeJpegSha256': hashlib.sha256(native.read_bytes()).hexdigest(),
        'comparisonResampling': 'Pillow bilinear', 'meanAbsoluteChannelDifference': stats.mean,
        'psnrDb': psnr, 'maximumTileChannelRms': max(tiles), 'tilesCompared': len(tiles),
        'exactJpegBytes': source.read_bytes() == native.read_bytes(),
        'modelComprehensionTested': False,
    }))
