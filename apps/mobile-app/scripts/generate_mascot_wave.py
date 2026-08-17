"""Generate the Inqora mascot's transparent waving animation with Pillow.

The source illustration stays still. Only the mascot's left forearm is cut into a
small sprite and rotated around the elbow, which makes the motion read as a wave
instead of a loading/bobbing animation.
"""

from pathlib import Path

from PIL import Image, ImageDraw


APP_ROOT = Path(__file__).resolve().parents[1]
SOURCE = APP_ROOT / "assets" / "images" / "inqora-mascot.png"
OUTPUT = APP_ROOT / "assets" / "images" / "inqora-mascot-wave.gif"

# Coordinates are measured against the 1206 x 1304 source illustration.
ELBOW = (285, 804)
FOREARM_SHAPE = [
    (187, 782),
    (327, 786),
    (353, 900),
    (338, 982),
    (302, 1018),
    (222, 1008),
    (177, 947),
]
ERASE_SHAPE = [
    (192, 810),
    (326, 807),
    (353, 900),
    (338, 982),
    (302, 1018),
    (222, 1008),
    (177, 947),
]


def rotate_about(image: Image.Image, angle: float, pivot: tuple[int, int]) -> Image.Image:
    """Rotate a full-size RGBA layer around an arbitrary pivot."""
    radians = angle * 3.141592653589793 / 180
    cosine = __import__("math").cos(radians)
    sine = __import__("math").sin(radians)
    px, py = pivot
    inverse = (
        cosine,
        sine,
        px - cosine * px - sine * py,
        -sine,
        cosine,
        py + sine * px - cosine * py,
    )
    return image.transform(
        image.size,
        Image.Transform.AFFINE,
        inverse,
        resample=Image.Resampling.BICUBIC,
    )


def build_frames(source: Image.Image) -> list[Image.Image]:
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).polygon(FOREARM_SHAPE, fill=255)
    erase_mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(erase_mask).polygon(ERASE_SHAPE, fill=255)

    forearm = Image.new("RGBA", source.size, (0, 0, 0, 0))
    forearm.paste(source, mask=mask)

    body = source.copy()
    body.paste((0, 0, 0, 0), mask=erase_mask)

    # Lift, wave twice, then settle. Repeated frames add natural pauses.
    angles = [0, 36, 72, 103, 120, 105, 122, 105, 122, 103, 72, 36, 0, 0]
    frames: list[Image.Image] = []
    for angle in angles:
        frame = body.copy()
        frame.alpha_composite(rotate_about(forearm, angle, ELBOW))
        frames.append(frame.resize((482, 522), Image.Resampling.LANCZOS))
    return frames


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    frames = build_frames(source)
    durations = [450, 70, 70, 80, 130, 105, 105, 105, 125, 80, 70, 70, 900, 450]

    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        disposal=2,
        transparency=0,
        optimize=False,
    )

    print(f"Generated {len(frames)} frames: {OUTPUT}")


if __name__ == "__main__":
    main()
