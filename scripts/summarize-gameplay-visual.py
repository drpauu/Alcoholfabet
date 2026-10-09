"""Measure saved local component captures; no application or network access."""
from pathlib import Path
from PIL import Image
import colorsys
import json
import math
import re
import statistics

ROOT = Path.cwd()
DIRECTORY = ROOT / 'acceptance/gameplay-refinement'
BASELINE = ROOT / 'audit/gameplay-refinement-before/BASELINE_REPORT.json'
REPORT = DIRECTORY / 'VISUAL_REPORT.json'
LINEAR = [value / 255 / 12.92 if value / 255 <= .04045 else ((value / 255 + .055) / 1.055) ** 2.4 for value in range(256)]


def luminance(rgb):
    return .2126 * LINEAR[rgb[0]] + .7152 * LINEAR[rgb[1]] + .0722 * LINEAR[rgb[2]]


def contrast(first, second):
    values = sorted([first, second])
    return (values[1] + .05) / (values[0] + .05)


def percentile(values, fraction):
    ordered = sorted(values)
    return ordered[round((len(ordered) - 1) * fraction)]


def color(value):
    return tuple(round(float(part)) for part in re.findall(r'[\d.]+', value)[:3])


def scene_metrics(path):
    # Numeric analysis only; original captures are retained without alteration.
    image = Image.open(path).convert('RGB').resize((160, 120))
    pixels = list(image.getdata())
    luminances = [luminance(pixel) for pixel in pixels]
    saturations = [colorsys.rgb_to_hsv(*(channel / 255 for channel in pixel))[1] for pixel in pixels]
    return {
        'meanRelativeLuminance': round(statistics.mean(luminances), 4),
        'medianRelativeLuminance': round(statistics.median(luminances), 4),
        'p95RelativeLuminance': round(percentile(luminances, .95), 4),
        'p95MinusP05Luminance': round(percentile(luminances, .95) - percentile(luminances, .05), 4),
        'meanHsvSaturation': round(statistics.mean(saturations), 4),
    }


def text_metrics(capture):
    visible = Image.open(ROOT / capture['path']).convert('RGB')
    background = Image.open(ROOT / capture['samplingPath']).convert('RGB')
    results = []
    for sample in capture['layout']['textSamples']:
        bounds = sample['bounds']
        box = (max(0, math.floor(bounds['left'])), max(0, math.floor(bounds['top'])), min(visible.width, math.ceil(bounds['right'])), min(visible.height, math.ceil(bounds['bottom'])))
        foreground = color(sample['color'])
        if len(foreground) != 3 or box[2] <= box[0] or box[3] <= box[1]:
            continue
        ratios = []
        first_pixels = list(visible.crop(box).getdata())
        second_pixels = list(background.crop(box).getdata())
        for rendered, behind in zip(first_pixels, second_pixels):
            # Require a nearly solid foreground pixel and a changed pixel. This
            # excludes ordinary scene pixels that happen to resemble the ink.
            if max(abs(rendered[index] - foreground[index]) for index in range(3)) <= 22 and sum(abs(rendered[index] - behind[index]) for index in range(3)) >= 32:
                ratios.append(contrast(luminance(foreground), luminance(behind)))
        item = {key: sample[key] for key in ['selector', 'text', 'fontSize', 'fontWeight', 'color']}
        item['glyphPixelsSampled'] = len(ratios)
        if ratios:
            item.update({
                'rawContrastP05': round(percentile(ratios, .05), 2),
                'rawContrastMedian': round(statistics.median(ratios), 2),
                'rawContrastMinimum': round(min(ratios), 2),
            })
        stroke_width = float(sample['textStrokeWidth'].replace('px', ''))
        if stroke_width:
            item['outline'] = {
                'widthPx': stroke_width,
                'color': sample['textStrokeColor'],
                'letterToOutlineContrast': round(contrast(luminance(foreground), luminance(color(sample['textStrokeColor']))), 2),
                'note': 'Local letter/outline contrast is reported separately from raw landscape contrast; this is not a full WCAG certification.',
            }
        results.append(item)
    return results


before = json.loads(BASELINE.read_text())
after = json.loads(REPORT.read_text())
comparisons = []
for width, height in after['viewports']:
    name = f'{width}x{height}'
    first_path = DIRECTORY / f'screenshots/background-before-{name}.png'
    second_path = DIRECTORY / f'screenshots/background-after-{name}.png'
    first, second = scene_metrics(first_path), scene_metrics(second_path)
    comparisons.append({
        'viewport': name,
        'beforePath': str(first_path.relative_to(ROOT)),
        'afterPath': str(second_path.relative_to(ROOT)),
        'method': 'Same current Scene raster and atmosphere with content hidden; baseline filter:none replayed from the pre-edit capture metadata. Final filter is the only difference.',
        'before': first,
        'after': second,
        'meanLuminanceChangePercent': round((second['meanRelativeLuminance'] / first['meanRelativeLuminance'] - 1) * 100, 1),
        'meanSaturationChangePercent': round((second['meanHsvSaturation'] / first['meanHsvSaturation'] - 1) * 100, 1),
        'luminanceSpreadChangePercent': round((second['p95MinusP05Luminance'] / first['p95MinusP05Luminance'] - 1) * 100, 1),
    })
text_comparisons = []
for final_capture in after['captures']:
    initial_capture = next(capture for capture in before['captures'] if all(capture[key] == final_capture[key] for key in ['scene', 'width', 'height']))
    text_comparisons.append({
        'scene': final_capture['scene'],
        'viewport': f"{final_capture['width']}x{final_capture['height']}",
        'baselinePath': initial_capture['path'],
        'finalPath': final_capture['path'],
        'before': text_metrics(initial_capture),
        'after': text_metrics(final_capture),
    })
after['backgroundComparison'] = comparisons
after['textComparison'] = text_comparisons
after['contrastMethod'] = 'sRGB relative luminance. Glyph interiors identified by foreground color and changed pixels in paired original/hidden-text screenshots; small antialias pixels excluded. Raw landscape contrast and outline contrast are separate. This is component QA, not a full screen-reader, WCAG or gameplay certification.'
after['baselineReport'] = str(BASELINE.relative_to(ROOT))
after['avatarSourcesUnchanged'] = after['assets'] == before['assets']
after['productionFilesChangedForVisualTask'] = ['src/styles/base.css', 'src/art-system/tokens.css']
REPORT.write_text(json.dumps(after, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': after['status'], 'backgroundComparison': comparisons, 'avatarSourcesUnchanged': after['avatarSourcesUnchanged']}, ensure_ascii=False))
