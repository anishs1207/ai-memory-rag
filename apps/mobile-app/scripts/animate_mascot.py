"""Prompt-driven 2D mascot animation compiler.

Example:
    python scripts/animate_mascot.py --image assets/images/inqora-mascot.png \
      --prompt "wave twice, nod and bounce happily" --output assets/images/qori-celebrate.gif

The compiler deliberately uses deterministic sprite motion so the mascot's face,
colours and costume stay consistent. A rig JSON can override normalized pivots and
polygons for another mascot. Supported prompt actions: wave, nod, bounce/jump,
think/tilt and celebrate.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


def parse_prompt(prompt: str) -> list[str]:
    text = prompt.lower()
    actions: list[str] = []
    if any(word in text for word in ("wave", "hello", "hi ", "greet")):
        actions.append("wave")
    if any(word in text for word in ("nod", "agree", "yes")):
        actions.append("nod")
    if any(word in text for word in ("jump", "bounce", "hop")):
        actions.append("bounce")
    if any(word in text for word in ("think", "curious", "tilt")):
        actions.append("tilt")
    if any(word in text for word in ("celebrate", "excited", "happy", "cheer")):
        actions.extend(action for action in ("wave", "bounce") if action not in actions)
    return actions or ["wave"]


def default_rig(width: int, height: int) -> dict[str, object]:
    # Normalized from the Inqora front-facing mascot; override with --rig for other art.
    return {
        "wave_pivot": [0.236 * width, 0.617 * height],
        "wave_polygon": [
            [0.155 * width, 0.600 * height], [0.271 * width, 0.603 * height],
            [0.293 * width, 0.690 * height], [0.280 * width, 0.753 * height],
            [0.250 * width, 0.781 * height], [0.184 * width, 0.773 * height],
            [0.147 * width, 0.726 * height],
        ],
    }


def rotate_about(layer: Image.Image, angle: float, pivot: tuple[float, float]) -> Image.Image:
    radians = math.radians(angle)
    cosine, sine = math.cos(radians), math.sin(radians)
    px, py = pivot
    inverse = (
        cosine, sine, px - cosine * px - sine * py,
        -sine, cosine, py + sine * px - cosine * py,
    )
    return layer.transform(layer.size, Image.Transform.AFFINE, inverse, resample=Image.Resampling.BICUBIC)


def translate(layer: Image.Image, x: float, y: float) -> Image.Image:
    return layer.transform(layer.size, Image.Transform.AFFINE, (1, 0, -x, 0, 1, -y), resample=Image.Resampling.BICUBIC)


def frame_values(actions: list[str], count: int = 24) -> list[dict[str, float]]:
    values: list[dict[str, float]] = []
    for index in range(count):
        phase = index / (count - 1)
        envelope = math.sin(math.pi * phase)
        wave = max(0.0, 108 * envelope + (12 * math.sin(phase * math.pi * 6) if phase > 0.25 else 0)) if "wave" in actions else 0
        nod = 5 * math.sin(phase * math.pi * 4) * envelope if "nod" in actions else 0
        bounce = -22 * abs(math.sin(phase * math.pi * 2)) * envelope if "bounce" in actions else 0
        tilt = 7 * math.sin(math.pi * phase) if "tilt" in actions else 0
        values.append({"wave": wave, "rotation": nod + tilt, "y": bounce})
    return values


def compile_animation(source: Image.Image, rig: dict[str, object], actions: list[str], output_size: int) -> list[Image.Image]:
    width, height = source.size
    polygon = [tuple(point) for point in rig["wave_polygon"]]  # type: ignore[arg-type]
    pivot = tuple(rig["wave_pivot"])  # type: ignore[arg-type]
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    limb = Image.new("RGBA", source.size, (0, 0, 0, 0))
    limb.paste(source, mask=mask)
    body = source.copy()
    if "wave" in actions:
        body.paste((0, 0, 0, 0), mask=mask)

    frames: list[Image.Image] = []
    for values in frame_values(actions):
        frame = body.copy()
        if "wave" in actions:
            frame.alpha_composite(rotate_about(limb, values["wave"], pivot))
        if values["rotation"]:
            frame = rotate_about(frame, values["rotation"], (width / 2, height * 0.65))
        if values["y"]:
            frame = translate(frame, 0, values["y"])
        target_height = round(output_size * height / width)
        frames.append(frame.resize((output_size, target_height), Image.Resampling.LANCZOS))
    return frames


def main() -> None:
    parser = argparse.ArgumentParser(description="Compile a mascot PNG and text prompt into an animation")
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--rig", type=Path)
    parser.add_argument("--size", type=int, default=482)
    parser.add_argument("--speed", choices=("calm", "normal", "lively"), default="normal")
    args = parser.parse_args()

    source = Image.open(args.image).convert("RGBA")
    rig = json.loads(args.rig.read_text()) if args.rig else default_rig(*source.size)
    actions = parse_prompt(args.prompt)
    frames = compile_animation(source, rig, actions, args.size)
    duration = {"calm": 150, "normal": 105, "lively": 72}[args.speed]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(args.output, save_all=True, append_images=frames[1:], duration=duration, loop=0, disposal=2, transparency=0)
    plan_path = args.output.with_suffix(".motion.json")
    plan_path.write_text(json.dumps({"prompt": args.prompt, "actions": actions, "speed": args.speed, "frames": len(frames)}, indent=2))
    print(f"Generated {args.output} with actions: {', '.join(actions)}")
    print(f"Motion plan: {plan_path}")


if __name__ == "__main__":
    main()
