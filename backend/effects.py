"""Catalog of cinematic effects with professional AI prompts.

Every prompt is engineered to preserve the person's identity, pose, background,
camera angle and lighting while applying ONLY the requested cinematic effect.
"""
from typing import List, Dict

_IDENTITY_LOCK = (
    "Keep the subject's face, identity, gender, age, ethnicity, hair, pose, "
    "clothing, framing, camera angle, focal length, depth of field, background, "
    "and lighting exactly the same. This is a fictional movie-style visual effect "
    "for entertainment. Do not alter anything except adding the specific effect "
    "described. Output must be photorealistic and cinematic, high resolution."
)

_OBJECT_LOCK = (
    "Keep the object's shape, orientation, background, camera angle, focal length, "
    "depth of field, and lighting exactly the same. Only modify the object's "
    "surface, condition, and cinematic mood as described. Output must be "
    "photorealistic, cinematic, high resolution."
)


def _fx(base: str, lock: str = _IDENTITY_LOCK) -> str:
    return f"{base} {lock}"


FACE_EFFECTS: List[Dict] = [
    {"id": "movie_bruises", "name": "Movie Bruises", "emoji": "🥊",
     "prompt": _fx("Add realistic Hollywood movie-style bruises and swelling around the cheekbone and jawline with subtle purple, red and yellow tones like professional SFX makeup.")},
    {"id": "black_eye", "name": "Black Eye", "emoji": "👊",
     "prompt": _fx("Add a realistic dark purple and blue swollen black eye around the left eye with subtle blood coloring, like a boxing movie scene.")},
    {"id": "bandages", "name": "Bandages", "emoji": "🩹",
     "prompt": _fx("Add realistic cinematic white gauze bandages wrapped diagonally around the head and cheek with small blood spots, like an action movie survivor.")},
    {"id": "swollen_face", "name": "Swollen Face", "emoji": "😵",
     "prompt": _fx("Add realistic post-fight facial swelling with cinematic redness and puffy skin around the cheeks and eye area.")},
    {"id": "action_hero", "name": "Action Movie Hero", "emoji": "💥",
     "prompt": _fx("Add cinematic action-hero grit: light dirt smudges, a few small cuts on cheek and forehead, sweat highlights and dramatic movie-style shadows.")},
    {"id": "zombie", "name": "Zombie Makeup", "emoji": "🧟",
     "prompt": _fx("Apply realistic Hollywood zombie SFX makeup: pale grayish skin, dark under-eye hollows, cracked lips, small rotting wounds on the cheek. Keep expression natural.")},
    {"id": "pirate_scar", "name": "Pirate Scar", "emoji": "🏴‍☠️",
     "prompt": _fx("Add a long dramatic cinematic scar across the cheek and over the eyebrow, like a movie pirate character. Photorealistic makeup effect only.")},
    {"id": "comic_fight", "name": "Comic Fight", "emoji": "💢",
     "prompt": _fx("Add cartoonish but photorealistic comic-book fight bruises with exaggerated purple and red spots and a small band-aid across the nose.")},
    {"id": "monster_attack", "name": "Monster Attack", "emoji": "👹",
     "prompt": _fx("Add three realistic parallel claw scratches across the cheek with subtle blood and torn skin, like a movie monster attack SFX.")},
    {"id": "vampire_bite", "name": "Vampire Bite", "emoji": "🧛",
     "prompt": _fx("Add two realistic vampire fang bite marks on the neck with a small trail of blood, cinematic gothic mood, movie SFX only.")},
    {"id": "alien_attack", "name": "Alien Attack", "emoji": "👽",
     "prompt": _fx("Add subtle glowing green alien slime residue and small futuristic burn marks on the cheek, sci-fi movie SFX style.")},
    {"id": "robot_damage", "name": "Robot Damage", "emoji": "🤖",
     "prompt": _fx("Reveal small metallic robotic circuits and cracked panels on one side of the face, like a Terminator-style movie SFX, keeping the rest of the face fully human.")},
    {"id": "fire_burn", "name": "Fire Burn FX", "emoji": "🔥",
     "prompt": _fx("Add cinematic light burn marks and soot smudges across the cheek and forehead with a warm ember glow, like an action movie survivor.")},
    {"id": "ice_damage", "name": "Ice Damage", "emoji": "❄️",
     "prompt": _fx("Add realistic frost, small ice crystals and pale frozen skin tone across the cheeks and eyebrows, like a frozen movie character.")},
    {"id": "magic_explosion", "name": "Magic Explosion", "emoji": "✨",
     "prompt": _fx("Add cinematic magical explosion residue: shimmering colored dust, small glowing sparks, and subtle soot around the face.")},
    {"id": "paintball", "name": "Paintball", "emoji": "🎨",
     "prompt": _fx("Add realistic bright neon paintball splatters (pink, yellow, blue) across the face and hair, dripping slightly. Fun and cinematic.")},
    {"id": "cake_smash", "name": "Cake Smash", "emoji": "🎂",
     "prompt": _fx("Add realistic cake smash effect: white frosting, sprinkles and small cake chunks splattered across the face and hair, comedy movie style.")},
    {"id": "food_fight", "name": "Food Fight", "emoji": "🍕",
     "prompt": _fx("Add realistic food fight mess across the face: tomato sauce, cheese, and small food bits splattered, comedy movie style.")},
    {"id": "funny_makeup", "name": "Funny Makeup", "emoji": "🤡",
     "prompt": _fx("Add exaggerated but photorealistic clown-like makeup: red nose, colorful cheek circles, and small stars around the eyes. Fun and playful.")},
    {"id": "hollywood_fx", "name": "Hollywood FX", "emoji": "🎬",
     "prompt": _fx("Apply premium Hollywood cinematic SFX makeup: subtle grit, dramatic shadow contour, small realistic wound near the temple with dried blood, like a blockbuster action still.")},
]

VEHICLE_EFFECTS: List[Dict] = [
    {"id": "broken_windshield", "name": "Broken Windshield", "emoji": "🚗",
     "prompt": _fx("Add a realistic cinematic cracked windshield with spider-web fracture pattern around a central impact point.", _OBJECT_LOCK)},
    {"id": "heavy_scratches", "name": "Heavy Scratches", "emoji": "🔧",
     "prompt": _fx("Add heavy realistic scratches and paint scrapes along the door panels and hood, like a movie chase scene.", _OBJECT_LOCK)},
    {"id": "mud", "name": "Mud", "emoji": "🟤",
     "prompt": _fx("Cover the vehicle with realistic thick mud splatters and dirt streaks across the body, wheels and windows, like an off-road movie scene.", _OBJECT_LOCK)},
    {"id": "rust", "name": "Rust", "emoji": "🦀",
     "prompt": _fx("Add realistic aged rust patches and corrosion across the body panels, wheel arches and edges, keeping the vehicle shape intact.", _OBJECT_LOCK)},
    {"id": "burned_paint", "name": "Burned Paint", "emoji": "🔥",
     "prompt": _fx("Add realistic burned and blistered paint with soot marks and heat damage on the hood and doors, cinematic action movie style.", _OBJECT_LOCK)},
    {"id": "police_chase", "name": "Police Chase Damage", "emoji": "🚨",
     "prompt": _fx("Add cinematic police chase damage: bullet holes on the door, dented panels, cracked side window and mud, like a Hollywood action movie.", _OBJECT_LOCK)},
    {"id": "apocalypse_car", "name": "Apocalypse Car", "emoji": "☢️",
     "prompt": _fx("Transform into a post-apocalyptic Mad Max-style vehicle: rust, welded metal patches, spikes, dust and battle damage. Keep the base vehicle recognizable.", _OBJECT_LOCK)},
    {"id": "monster_truck", "name": "Monster Truck Damage", "emoji": "🛻",
     "prompt": _fx("Add monster-truck-style battle damage: torn bumpers, missing panels, thick mud, and heavy scratches from an off-road rally.", _OBJECT_LOCK)},
    {"id": "abandoned_car", "name": "Old Abandoned Car", "emoji": "🕸️",
     "prompt": _fx("Age the vehicle by decades: heavy rust, faded paint, cracked windows, flat tires and vines growing over it, like an abandoned movie prop.", _OBJECT_LOCK)},
    {"id": "flood_car", "name": "Flood Damage", "emoji": "🌊",
     "prompt": _fx("Add realistic flood damage: water stains, muddy waterline, algae streaks, and wet reflective surfaces, like a disaster movie.", _OBJECT_LOCK)},
    {"id": "comic_crash", "name": "Comic Crash", "emoji": "💥",
     "prompt": _fx("Add cartoonish but photorealistic comic-book style crash damage: crumpled hood, one flat tire, and a small cloud of smoke.", _OBJECT_LOCK)},
    {"id": "movie_explosion", "name": "Movie Explosion FX", "emoji": "💣",
     "prompt": _fx("Add cinematic Hollywood explosion damage on the vehicle: charred hood, blown-out windows, and heavy smoke around it. Movie SFX style.", _OBJECT_LOCK)},
]

HOUSE_EFFECTS: List[Dict] = [
    {"id": "destroyed_wall", "name": "Destroyed Wall", "emoji": "🧱",
     "prompt": _fx("Add a cinematic destroyed wall section with exposed bricks, rubble on the ground and dust in the air, like an action movie set.", _OBJECT_LOCK)},
    {"id": "broken_windows", "name": "Broken Windows", "emoji": "🪟",
     "prompt": _fx("Break all the visible windows with realistic shattered glass, jagged edges and small debris on the sills.", _OBJECT_LOCK)},
    {"id": "house_flood", "name": "Flood Damage", "emoji": "🌊",
     "prompt": _fx("Add flood damage to the house: high water line stains, mud streaks, algae, and wet reflective surfaces around the base.", _OBJECT_LOCK)},
    {"id": "house_fire", "name": "Fire Damage", "emoji": "🔥",
     "prompt": _fx("Add cinematic fire damage to the house: charred walls, blackened windows, smoke rising and glowing embers on the roof.", _OBJECT_LOCK)},
    {"id": "haunted_house", "name": "Old Haunted House", "emoji": "👻",
     "prompt": _fx("Transform into a cinematic old haunted house: cracked paint, boarded windows, cobwebs, twisted trees, moody purple night sky.", _OBJECT_LOCK)},
    {"id": "jungle_house", "name": "Jungle House", "emoji": "🌿",
     "prompt": _fx("Overgrow the house with cinematic dense jungle: thick vines, tropical plants, moss and hanging leaves covering walls and roof.", _OBJECT_LOCK)},
    {"id": "snow_house", "name": "Snow Covered House", "emoji": "❄️",
     "prompt": _fx("Cover the house in deep cinematic snow: thick snow on the roof, icicles on the eaves, frost on windows, snowy ground.", _OBJECT_LOCK)},
    {"id": "post_apocalypse", "name": "Post Apocalypse", "emoji": "☢️",
     "prompt": _fx("Transform the house into a post-apocalyptic ruin: broken walls, ash on the ground, dust in the air, faded colors, moody sky.", _OBJECT_LOCK)},
    {"id": "hollywood_explosion", "name": "Hollywood Explosion FX", "emoji": "💥",
     "prompt": _fx("Add a cinematic Hollywood-style explosion effect on the house: flying debris, orange fire ball, thick smoke, dramatic movie lighting.", _OBJECT_LOCK)},
    {"id": "abandoned_building", "name": "Abandoned Building", "emoji": "🏚️",
     "prompt": _fx("Age the building by decades: peeling paint, broken windows, graffiti, overgrown weeds and moody abandoned atmosphere.", _OBJECT_LOCK)},
]

OBJECT_EFFECTS: List[Dict] = [
    {"id": "cinematic_phone", "name": "Cinematic Phone", "emoji": "📱",
     "prompt": _fx("Transform the phone into a premium cinematic version with subtle scratches, dramatic movie lighting and a moody film-noir vibe.", _OBJECT_LOCK)},
    {"id": "cinematic_laptop", "name": "Cinematic Laptop", "emoji": "💻",
     "prompt": _fx("Turn the laptop into a cinematic hacker-movie prop: glowing screen reflections, dust, cinematic side lighting and moody atmosphere.", _OBJECT_LOCK)},
    {"id": "cinematic_tv", "name": "Cinematic TV", "emoji": "📺",
     "prompt": _fx("Transform the TV into a cinematic retro or futuristic version with atmospheric glow, subtle static and dramatic movie lighting.", _OBJECT_LOCK)},
    {"id": "cinematic_motorcycle", "name": "Cinematic Motorcycle", "emoji": "🏍️",
     "prompt": _fx("Turn the motorcycle into a cinematic action-movie version with subtle scratches, mud spots and dramatic side lighting.", _OBJECT_LOCK)},
    {"id": "cinematic_boat", "name": "Cinematic Boat", "emoji": "🚤",
     "prompt": _fx("Transform the boat into a cinematic adventure-movie version with weathered paint, water streaks and moody film lighting.", _OBJECT_LOCK)},
    {"id": "cinematic_bicycle", "name": "Cinematic Bicycle", "emoji": "🚲",
     "prompt": _fx("Turn the bicycle into a cinematic vintage-movie version with subtle rust, worn paint and warm nostalgic lighting.", _OBJECT_LOCK)},
    {"id": "cinematic_furniture", "name": "Cinematic Furniture", "emoji": "🛋️",
     "prompt": _fx("Age the furniture into a cinematic vintage prop with worn fabric, subtle dust and dramatic film-set lighting.", _OBJECT_LOCK)},
    {"id": "cinematic_electronics", "name": "Cinematic Electronics", "emoji": "🎛️",
     "prompt": _fx("Turn the electronics into a cinematic sci-fi movie prop with glowing indicators, subtle wear and dramatic side lighting.", _OBJECT_LOCK)},
]

CATEGORIES = [
    {"id": "face", "name": "Face", "emoji": "😎", "effects": FACE_EFFECTS, "premium_tier": "face_effects"},
    {"id": "vehicle", "name": "Vehicle", "emoji": "🚗", "effects": VEHICLE_EFFECTS, "premium_tier": "ultimate"},
    {"id": "house", "name": "House", "emoji": "🏠", "effects": HOUSE_EFFECTS, "premium_tier": "ultimate"},
    {"id": "object", "name": "Object", "emoji": "📦", "effects": OBJECT_EFFECTS, "premium_tier": "ultimate"},
]


def get_effect_by_id(effect_id: str) -> Dict | None:
    for cat in CATEGORIES:
        for e in cat["effects"]:
            if e["id"] == effect_id:
                return {**e, "category": cat["id"], "premium_tier": cat["premium_tier"]}
    return None


def get_public_catalog() -> List[Dict]:
    """Return catalog without exposing raw prompts to the client."""
    return [
        {
            "id": cat["id"],
            "name": cat["name"],
            "emoji": cat["emoji"],
            "premium_tier": cat["premium_tier"],
            "effects": [
                {"id": e["id"], "name": e["name"], "emoji": e["emoji"]}
                for e in cat["effects"]
            ],
        }
        for cat in CATEGORIES
    ]
