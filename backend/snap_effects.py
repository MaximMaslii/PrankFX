"""Catalog of Snap effects — the short-video format.

Two kinds of Snap live here, told apart by `engine` / `input`:

  * "lucy" / "video"   — the original snap-your-fingers format. The user
    records five seconds, the tail is edited by Decart Lucy (video-to-video)
    and the clip loops back into its first frame. Only "Fire in the palm"
    stays in this family.

  * "photo" — a single photo is brought to life. Two engines can do it,
    switched by SNAP_PHOTO_ENGINE in backend/.env:
      - Decart Lucy 2.5: the photo becomes a 5-second still clip and Lucy
        edits the transformation into it (uses `lucy_prompt`);
      - PixVerse v5.5 via fal.ai: true image-to-video (uses `pixverse_prompt`). These are the
    "you have never seen this before" transformations: the person melts into
    mercury, climbs out of the picture, folds into a paper crane…

PixVerse prompts follow the model's taste: one continuous action described
start-to-finish, the camera explicitly locked, and the person's identity
pinned so the first frames still look like the uploaded photo. Everything is
in English — the model reads English best, and the prompt limit is counted in
bytes, which Cyrillic would eat twice as fast.
"""
from typing import Dict, List


# --------------------------------------------------------------------------
# Timing of the five seconds (recorded Snaps only). Every number here is
# load-bearing: the recorder metronome, the ffmpeg cuts and the loop all read
# from it.
# --------------------------------------------------------------------------

SNAP_TOTAL_SECONDS = 5.0

# The moment the flash + haptic fires on the phone, and the exact frame the
# backend cuts at. Everything before it is the untouched original.
SNAP_AT_SECONDS = 1.2

# "Get back into your pose" hint.
SNAP_RETURN_HINT_SECONDS = 4.0

# Length of the frozen frame-zero tail the clip collapses into.
SNAP_TAIL_SECONDS = 0.4

# Where the crossfade into that tail starts (TOTAL - TAIL).
SNAP_XFADE_OFFSET = SNAP_TOTAL_SECONDS - SNAP_TAIL_SECONDS

SNAP_OUTPUT_WIDTH = 720
SNAP_OUTPUT_HEIGHT = 1280
SNAP_OUTPUT_FPS = 30


ENGINE_LUCY = "lucy"
ENGINE_PIXVERSE = "pixverse"

INPUT_VIDEO = "video"
INPUT_PHOTO = "photo"


# Appended to every PixVerse prompt. Keeps the face recognisable and the
# frame steady — a drifting camera is what makes AI clips look cheap.
# Every prompt is written as a timeline — what happens in second 0-1, then
# 1-3, then 3-5. Image-to-video models otherwise spend the clip "breathing"
# and apply the effect in the last half-second, which is exactly the flat,
# nothing-happens result that dies on TikTok. The first second has to move.
_PIXVERSE_TAIL = (
    " Keep the person's face, hairstyle and clothes identical to the photo in "
    "the very first frame. Strong, clearly visible motion starting in the "
    "first second and building to a dramatic finish. Static locked-off camera, "
    "photorealistic, cinematic lighting."
)

PIXVERSE_NEGATIVE_PROMPT = (
    "blurry, low quality, pixelated, distorted face, deformed body, extra "
    "limbs, extra fingers, morphing identity, flicker, jitter, shaky camera, "
    "text, subtitles, logo, watermark"
)


SNAP_EFFECTS: List[Dict] = [
    # ----------------------------------------------------------------------
    # Recorded (Decart Lucy)
    # ----------------------------------------------------------------------
    {
        "id": "snap_fire",
        "name": "Fire in the palm",
        "emoji": "🔥",
        "engine": ENGINE_LUCY,
        "input": INPUT_VIDEO,
        "badge": None,
        "age_restricted": False,
        "lucy_prompt": (
            "Add a growing flame to the person's right hand. The fire starts "
            "small at the fingertips, spreads across the palm, and rises into "
            "a steady burning flame with orange light reflecting on the face "
            "and nearby surfaces. Keep the person, the pose, the background "
            "and the camera exactly as they are."
        ),
    },

    # ----------------------------------------------------------------------
    # From a photo (PixVerse v5.5)
    # ----------------------------------------------------------------------
    {
        "id": "snap_liquid_metal",
        "name": "Liquid metal",
        "emoji": "🪞",
        "engine": ENGINE_PIXVERSE,
        "input": INPUT_PHOTO,
        "badge": "hit",
        "age_restricted": False,
        "lucy_prompt": (
            'The person gradually melts from head to toe into a shiny mirror-like puddle of liquid mercury on the floor, then rises back up as a fully chrome, polished-metal version of themselves. Background and camera unchanged.'
        ),
        "pixverse_prompt": (
            "Immediately, the person's skin starts turning into glossy liquid mercury from the top of the head downward, rippling and dripping. By second two the whole body collapses and melts into a shiny mirror-like puddle of mercury on the floor that reflects the room. In the last two seconds the puddle surges upward and reassembles into the same person, now completely chrome, with polished mirror-metal skin, hair and clothes, who turns the head and stares straight into the camera."
        ),
    },
    {
        "id": "snap_exit_photo",
        "name": "Out of the photo",
        "emoji": "🖼️",
        "engine": ENGINE_PIXVERSE,
        "input": INPUT_PHOTO,
        "badge": "hit",
        "age_restricted": False,
        "lucy_prompt": (
            "Cracks spread across the image like shattering glass, the glass breaks apart, and the person leans forward and climbs out of the picture toward the camera while glass shards fall. Keep the person's identity."
        ),
        "pixverse_prompt": (
            'The image is a photo inside a picture frame. In the first second the person blinks and their eyes move to the camera, then cracks shoot across the glass. The glass shatters outward toward the viewer, the person pushes a hand through the frame, then leans forward and climbs out of the picture toward the camera in 3D while shards fly past the lens. The person ends very close to the camera, grinning.'
        ),
    },
    {
        "id": "snap_origami",
        "name": "Origami crane",
        "emoji": "🕊️",
        "engine": ENGINE_PIXVERSE,
        "input": INPUT_PHOTO,
        "badge": "new",
        "age_restricted": False,
        "lucy_prompt": (
            "The person's body turns into white folded paper and folds smaller and smaller into a white origami paper crane, which flaps its wings and flies out of the frame. Background unchanged."
        ),
        "pixverse_prompt": (
            "Immediately, sharp paper creases spread across the person's body and their skin and clothes turn into white folded paper. The body folds in on itself again and again, getting smaller each time, until by second three it has become a white origami paper crane standing where the person was. The paper crane flaps its wings, lifts off and flies out of the frame. Crisp paper texture, the background stays unchanged."
        ),
    },
    {
        "id": "snap_eraser",
        "name": "Giant eraser",
        "emoji": "✏️",
        "engine": ENGINE_PIXVERSE,
        "input": INPUT_PHOTO,
        "badge": None,
        "age_restricted": False,
        "lucy_prompt": (
            'The whole image turns into a black-and-white pencil sketch on paper, then a giant pink rubber eraser sweeps across and erases the person in wide strokes, leaving blank paper and eraser crumbs.'
        ),
        "pixverse_prompt": (
            'In the first second the whole photo transforms into a black-and-white graphite pencil sketch on white paper. A giant pink rubber eraser swoops in from the top of the frame and rubs back and forth over the person in fast, wide strokes, erasing them stroke by stroke while eraser crumbs fly. By the end the person is completely erased and only the sketched background and the crumbs remain.'
        ),
    },
    {
        "id": "snap_toy_table",
        "name": "Tiny toy",
        "emoji": "🧸",
        "engine": ENGINE_PIXVERSE,
        "input": INPUT_PHOTO,
        "badge": "new",
        "age_restricted": False,
        "lucy_prompt": (
            'The person shrinks into a small glossy plastic toy figurine standing on a wooden table, then a giant human hand reaches in from above and picks the figurine up. Keep the face and outfit.'
        ),
        "pixverse_prompt": (
            'Immediately the person starts shrinking rapidly while the surroundings grow huge, and by second two they have become a small glossy plastic toy figurine with the same face and outfit, standing on a wooden tabletop. A giant real human hand enters from the top of the frame, pinches the tiny figurine between two fingers and lifts it up and out of the frame. Tilt-shift miniature look.'
        ),
    },
    {
        "id": "snap_antigravity",
        "name": "Antigravity",
        "emoji": "🪐",
        "engine": ENGINE_PIXVERSE,
        "input": INPUT_PHOTO,
        "badge": None,
        "age_restricted": False,
        "lucy_prompt": (
            'Gravity switches off: the person and every loose object around them slowly float upward, hair and clothes drifting weightlessly, small objects rotating in the air. Camera and background unchanged.'
        ),
        "pixverse_prompt": (
            "Immediately gravity switches off. The person's hair and clothes lift upward, their feet leave the ground and they start floating up with a surprised expression, arms drifting. Every loose object around them rises and slowly rotates in the air. By the end the person is floating high in the frame among the drifting objects. Dreamy slow motion."
        ),
    },
    {
        "id": "snap_portal",
        "name": "Portal",
        "emoji": "🌀",
        "engine": ENGINE_PIXVERSE,
        "input": INPUT_PHOTO,
        "badge": "hit",
        "age_restricted": False,
        "lucy_prompt": (
            'A glowing swirling blue-violet portal opens in the air behind the person, wind pulls their hair and clothes backward, and the person is sucked into the portal, which closes with a bright flash.'
        ),
        "pixverse_prompt": (
            'In the first second a glowing, swirling blue-violet portal rips open in the air right behind the person, crackling with energy and throwing light over them. A powerful wind pulls toward it: hair and clothes whip backward, the person leans forward and struggles, then is yanked backward off their feet into the swirling portal. The portal collapses shut with a bright flash, leaving the scene empty.'
        ),
    },
    {
        "id": "snap_pixel_decay",
        "name": "Pixel decay",
        "emoji": "🧊",
        "engine": ENGINE_PIXVERSE,
        "input": INPUT_PHOTO,
        "badge": None,
        "age_restricted": False,
        "lucy_prompt": (
            'The person disintegrates into thousands of glowing 3D voxel cubes that break apart and fly away in every direction until only the background remains. Background and camera unchanged.'
        ),
        "pixverse_prompt": (
            'Immediately the edges of the person begin breaking apart into small glowing 3D voxel cubes. The disintegration races across the whole body within two seconds while the person looks down at their dissolving hands in shock. The cubes burst apart and fly in every direction, some toward the camera, scattering through the air until the person has completely vanished and only the background remains.'
        ),
    },
]


def get_snap_effect_by_id(effect_id: str) -> Dict | None:
    for effect in SNAP_EFFECTS:
        if effect["id"] == effect_id:
            return effect

    return None


def pixverse_prompt_for(effect: Dict) -> str:
    """The full PixVerse prompt, identity/camera clause included."""
    return effect["pixverse_prompt"].strip() + _PIXVERSE_TAIL


# --------------------------------------------------------------------------
# Localised copy, served with the catalog.
#
# The app shows these first and falls back to its own bundled strings, so an
# effect added (or renamed) HERE appears in the live app with proper names in
# every language — no app release, no over-the-air update.
# --------------------------------------------------------------------------

SNAP_COPY: Dict[str, Dict[str, Dict[str, str]]] = {
    "snap_fire": {
        "title": {"en": "Fire in the palm", "ru": "Огонь из ладони", "de": "Feuer in der Hand"},
        "tagline": {
            "en": "Flames bloom in your palm on the snap",
            "ru": "По щелчку в ладони вспыхивает огонь",
            "de": "Beim Schnippen lodern Flammen in deiner Hand",
        },
    },
    "snap_liquid_metal": {
        "title": {"en": "Liquid metal", "ru": "Жидкий металл", "de": "Flüssiges Metall"},
        "tagline": {
            "en": "Melt into mercury, rise again in chrome",
            "ru": "Растекаешься ртутью, встаёшь хромом",
            "de": "Zu Quecksilber schmelzen, verchromt zurückkehren",
        },
    },
    "snap_exit_photo": {
        "title": {"en": "Out of the photo", "ru": "Выход из фото", "de": "Raus aus dem Foto"},
        "tagline": {
            "en": "The frame cracks — you step out of it",
            "ru": "Кадр трескается — и ты вылезаешь к зрителю",
            "de": "Der Rahmen splittert — du steigst heraus",
        },
    },
    "snap_origami": {
        "title": {"en": "Origami crane", "ru": "Оригами", "de": "Origami-Kranich"},
        "tagline": {
            "en": "Fold into a paper crane and fly away",
            "ru": "Складываешься в журавлика и улетаешь",
            "de": "Zum Papierkranich falten und davonfliegen",
        },
    },
    "snap_eraser": {
        "title": {"en": "Giant eraser", "ru": "Ластик", "de": "Riesen-Radiergummi"},
        "tagline": {
            "en": "A giant eraser wipes you off the sketch",
            "ru": "Гигантский ластик стирает тебя с наброска",
            "de": "Ein Riesen-Radiergummi löscht dich aus der Skizze",
        },
    },
    "snap_toy_table": {
        "title": {"en": "Tiny toy", "ru": "Игрушка на столе", "de": "Mini-Figur"},
        "tagline": {
            "en": "Shrink to a figurine — a huge hand picks you up",
            "ru": "Ты — фигурка, и огромная рука берёт тебя со стола",
            "de": "Als Figur geschrumpft — eine Riesenhand hebt dich hoch",
        },
    },
    "snap_antigravity": {
        "title": {"en": "Antigravity", "ru": "Антигравитация", "de": "Antigravitation"},
        "tagline": {
            "en": "You and everything around float upward",
            "ru": "Ты и всё вокруг медленно всплываете вверх",
            "de": "Du und alles um dich schwebt nach oben",
        },
    },
    "snap_portal": {
        "title": {"en": "Portal", "ru": "Портал за спиной", "de": "Portal"},
        "tagline": {
            "en": "A glowing rift opens and pulls you in",
            "ru": "Сзади открывается разлом и затягивает тебя",
            "de": "Ein leuchtender Riss öffnet sich und zieht dich hinein",
        },
    },
    "snap_pixel_decay": {
        "title": {"en": "Pixel decay", "ru": "Пиксельный распад", "de": "Pixel-Zerfall"},
        "tagline": {
            "en": "Shatter into 3D pixels that fly apart",
            "ru": "Рассыпаешься на 3D-пиксели, и они разлетаются",
            "de": "In 3D-Pixel zerfallen, die davonfliegen",
        },
    },
}


def get_snap_catalog(
    fx_cost: int,
    photo_engine: str = ENGINE_PIXVERSE,
    enabled: set[str] | None = None,
) -> List[Dict]:
    """Public catalog — the model prompts never leave the server.

    Effects not in `enabled` are still listed, marked `coming_soon`, so the
    app can tease them; `None` means everything is enabled. Enabled effects
    come first, in catalog order.
    """
    items = [
        {
            "id": effect["id"],
            "name": effect["name"],
            "emoji": effect["emoji"],
            "age_restricted": effect["age_restricted"],
            "fx_cost": fx_cost,
            "engine": photo_engine if effect["input"] == INPUT_PHOTO else effect["engine"],
            "input": effect["input"],
            "badge": effect.get("badge"),
            "title": (SNAP_COPY.get(effect["id"]) or {}).get("title") or {},
            "tagline": (SNAP_COPY.get(effect["id"]) or {}).get("tagline") or {},
            "coming_soon": enabled is not None and effect["id"] not in enabled,
        }
        for effect in SNAP_EFFECTS
    ]

    return sorted(items, key=lambda item: item["coming_soon"])
