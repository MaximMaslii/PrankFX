"""Catalog of cinematic effects with professional AI prompts.

Every prompt is engineered to preserve the person's identity, pose, background,
camera angle and lighting while applying ONLY the requested cinematic effect.
"""
from typing import List, Dict

_IDENTITY_LOCK = (
    "STRICT IMAGE EDIT. Preserve the original photograph exactly. "
    "Keep the person's identity, facial identity, facial proportions, "
    "facial structure, eyes, nose, mouth, teeth, skin tone, hair, hairstyle, "
    "age, gender, body shape, pose, hands, clothing, accessories and expression "
    "unchanged. Preserve the exact camera angle, framing, composition, "
    "perspective, focal length, depth of field, background, environment, "
    "objects, colors and lighting. "
    "Do not regenerate, replace, beautify, reshape or redesign the person. "
    "Do not change the background or camera composition. "
    "ONLY add the specific visual effect requested below. "
    "The effect must look like professional Hollywood practical SFX makeup "
    "or realistic movie VFX physically applied to the original photograph. "
    "The result must remain clearly the same photograph and the same person. "
    "Photorealistic, seamless integration, natural skin texture, "
    "cinematic high-resolution result."
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
    {
    "id": "movie_bruises",
    "name": "Movie Bruises",
    "emoji": "🥉",
    "prompt": _fx(
        "Create a strong, realistic Hollywood movie fight aftermath SFX makeup "
        "effect while preserving the original photograph and the exact identity "
        "of the person. The result should look like the person has just been "
        "through a serious physical fight. "

        "Add multiple clearly visible bruises across the face, especially around "
        "both cheekbones, jawline, temples and under-eye areas. Use realistic "
        "layers of deep purple, blue, red, burgundy and yellow-green bruising with "
        "different ages and intensities. "

        "Add noticeable facial swelling and puffiness around the cheeks, "
        "cheekbones, lips and under-eye areas. Make the swelling clearly visible "
        "but anatomically realistic. "

        "Add several realistic superficial abrasions and scratches on the "
        "forehead, cheeks, nose and chin. Include a few small fresh abrasions "
        "with subtle traces of blood and dried blood around them. Add realistic "
        "minor blood smears and streaks on the skin, especially around the nose, "
        "lips and scratched areas. Blood should remain cinematic and believable, "
        "not excessive or graphic. "

        "Add subtle dark red and purple blood pooling beneath a few bruises and "
        "small dried blood marks where appropriate. Add realistic skin texture "
        "around every injury so that the effects look physically present on the "
        "original skin. "

        "Create varied injury intensity: some bruises should be large and dark, "
        "some smaller and fading, with several overlapping bruises, abrasions and "
        "swollen areas. The overall face should clearly communicate a recent "
        "movie fight rather than a single isolated bruise. "

        "ABSOLUTELY DO NOT change the person's identity, facial proportions, "
        "eyes, nose, mouth, teeth, hairstyle, expression, body, clothing, hands, "
        "background, objects, camera angle, composition or lighting. Do not "
        "regenerate the face. Do not beautify or reshape the person. Only add "
        "the requested cinematic SFX injuries to the existing photograph. "
        "Photorealistic professional Hollywood makeup and VFX, seamless skin "
        "integration, realistic lighting and high-resolution detail."
    ),
},
{
    "id": "black_eye",
    "name": "Black Eye",
    "emoji": "👊",
    "prompt": _fx(
        "Create a strong, realistic Hollywood black-eye SFX makeup effect "
        "while preserving the original photograph and exact identity of the person. "

        "Add a clearly visible, substantial black eye around the LEFT eye, "
        "extending naturally across the upper eyelid, lower eyelid, under-eye area "
        "and outer corner of the eye. "

        "Use layered realistic colors including deep purple, dark blue, burgundy, "
        "red and subtle yellow-green tones around the outer edges, creating the "
        "appearance of a significant recent bruise. "

        "Add noticeable but anatomically realistic swelling around the eye and "
        "upper cheekbone. Make the eyelid and surrounding tissue visibly puffy "
        "without changing the actual shape, position or structure of the eye. "

        "Add several small superficial scratches and abrasions around the eyebrow, "
        "temple and cheekbone, with subtle traces of dried blood on a few of them. "

        "Add realistic skin texture, discoloration and soft transitions between "
        "healthy skin and bruised areas. The injury should look like professional "
        "Hollywood practical SFX makeup rather than a painted filter. "

        "The black eye should be clearly noticeable at first glance and occupy a "
        "realistic area around the eye, while remaining believable and cinematic. "

        "ABSOLUTELY DO NOT change the person's identity, facial proportions, "
        "eye color, eyeball, nose, mouth, teeth, hairstyle, expression, body, "
        "clothing, hands, background, objects, camera angle, composition or lighting. "
        "Do not close, replace, regenerate or reshape the eye. "
        "Do not regenerate the face. "
        "Only add the requested cinematic injury effects to the existing photograph. "

        "Photorealistic professional Hollywood SFX makeup, seamless integration, "
        "natural skin texture, realistic lighting and high-resolution detail."
    ),
},
{
    "id": "swollen_face",
    "name": "Swollen Face",
    "emoji": "🤕",
    "prompt": _fx(
        "Create a strong, realistic Hollywood movie SFX effect showing "
        "significant facial swelling after a recent physical fight, while "
        "preserving the original photograph and the exact identity of the person. "

        "Add clearly visible swelling and puffiness across both cheeks, "
        "cheekbones, under-eye areas, jawline and around the lips. The swelling "
        "should be uneven and naturally distributed, with some areas more swollen "
        "than others, creating the appearance of a serious but believable "
        "post-fight facial injury. "

        "Add realistic redness, mild purple and reddish discoloration and subtle "
        "bruising beneath the swollen areas. Include several smaller bruised areas "
        "around the cheekbones and jawline to make the injury look more natural. "

        "Add a few superficial scratches and abrasions on the cheeks, forehead "
        "and chin, with very subtle dried blood traces on some of the scratches. "
        "Keep all injuries cinematic and believable, without graphic open wounds. "

        "Make the cheeks visibly fuller and puffy because of swelling, especially "
        "around the cheekbones and under the eyes. Add realistic skin tension, "
        "soft tissue puffiness and subtle changes in skin texture around the "
        "affected areas. "

        "The result should immediately communicate that the person has suffered "
        "a strong impact to the face, similar to professional Hollywood makeup "
        "and movie VFX. The swelling should be clearly visible at first glance "
        "but remain anatomically realistic. "

        "ABSOLUTELY DO NOT change the person's identity, facial identity, "
        "facial proportions, eyes, eyeballs, nose, mouth, teeth, hairstyle, "
        "expression, body, clothing, hands, background, objects, camera angle, "
        "composition or lighting. Do not reshape or regenerate the face. "
        "Do not make the person unrecognizable. "
        "Only add realistic swelling, bruising and superficial SFX injuries "
        "to the existing photograph. "

        "Photorealistic professional Hollywood SFX makeup and VFX, seamless "
        "integration with the original skin texture, realistic lighting and "
        "high-resolution cinematic detail."
    ),
},    
{"id": "bandages", "name": "Bandages", "emoji": "🩹",
     "prompt": _fx("Add realistic cinematic white gauze bandages wrapped diagonally around the head and cheek with small blood spots, like an action movie survivor.")},
    {
    "id": "action_hero",
    "name": "Action Movie Hero",
    "emoji": "💥",
    "prompt": _fx(
        "Create a strong, realistic Hollywood action-movie aftermath SFX "
        "effect while preserving the original photograph and the exact identity "
        "of the person. The person should look like an action movie hero who "
        "has just survived a serious fight. "

        "Add multiple clearly visible facial bruises across the cheekbones, "
        "jawline, temples and under-eye areas. Use layered realistic purple, "
        "blue, red, burgundy and subtle yellow-green discoloration with "
        "different sizes and intensities. "

        "Add noticeable but anatomically realistic swelling and puffiness "
        "around the cheeks, cheekbones and under-eye areas. Add subtle swelling "
        "around the lips and jawline where appropriate. "

        "Add numerous superficial scratches and abrasions of different sizes "
        "across the forehead, cheeks, nose, chin and jawline. Some scratches "
        "should be thin and linear while others should look like small scraped "
        "areas from a recent fight. "

        "Add subtle redness and irritation around the scratches and bruises. "
        "Include a few small cinematic traces of fresh or dried blood near "
        "selected superficial scratches, especially around the nose, lips and "
        "cheeks. Keep blood limited, realistic and non-graphic. "

        "Create varied injury intensity: several prominent bruises and swollen "
        "areas combined with many smaller scratches and abrasions. The injuries "
        "should look naturally distributed rather than like a repeated filter. "

        "Preserve natural skin pores, texture and realistic transitions between "
        "healthy and injured skin. Make the overall result immediately readable "
        "as a professional Hollywood action-film makeup and VFX effect. "

        "The person must remain clearly recognizable as the same person in the "
        "original photograph. Preserve the original pose, expression, clothing, "
        "background, camera angle, composition and lighting. "

        "ABSOLUTELY DO NOT change the person's identity, facial proportions, "
        "eyes, eyeballs, nose, mouth, teeth, hairstyle, expression, body, "
        "clothing, hands, background, objects, camera angle, composition or "
        "lighting. Do not regenerate, replace, beautify or reshape the face. "
        "Do not make the person unrecognizable. Only add the requested "
        "cinematic SFX injuries to the existing photograph. "

        "Photorealistic professional Hollywood practical SFX makeup and VFX, "
        "seamless integration with the original skin texture, realistic "
        "lighting and high-resolution cinematic detail."
    ),
},
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
     "prompt": _fx(
    	"Create a strong, realistic Hollywood movie SFX effect showing "
    	"multiple clearly visible scratches, abrasions and superficial impact "
    	"damage on the subject. Preserve the original photograph and exact "
    	"identity of the person. "

    	"Add numerous realistic superficial scratches of different lengths, "
    	"widths, directions and intensity across the visible affected areas. "
    	"Include several prominent scratches together with many smaller "
    	"scratches and abrasions so the effect is clearly noticeable at first glance. "

    	"Add realistic redness, irritated skin and subtle swelling around some "
    	"of the scratches. Create natural variation: some marks should look fresh "
    	"and reddish while others should appear slightly older with darker "
    	"discoloration and subtle dried-blood traces. "

    	"Add a few small cinematic blood traces around selected superficial "
    	"scratches, keeping the blood limited and believable. Do not create "
    	"deep open wounds or graphic gore. "

    	"Preserve realistic skin texture, pores and natural transitions between "
    	"undamaged and affected areas. The scratches should look physically "
    	"present on the original skin, like professional Hollywood practical "
    	"SFX makeup rather than a digital filter. "

    	"Distribute the scratches naturally instead of creating repeated patterns. "
    	"Use different sizes, angles, spacing and intensity for a realistic "
    	"post-fight appearance. "

    	"ABSOLUTELY DO NOT change the person's identity, facial proportions, "
    	"eyes, nose, mouth, teeth, hairstyle, expression, body, clothing, hands, "
    	"background, objects, camera angle, composition or lighting. Do not "
    	"regenerate or reshape the person. Only add the requested superficial "
    	"scratches, abrasions, redness, swelling and small cinematic blood traces "
    	"to the existing photograph. "

    	"Photorealistic professional Hollywood SFX makeup, seamless integration, "
    	"natural skin texture, realistic lighting and high-resolution cinematic detail."
)},
    {"id": "mud", "name": "Mud", "emoji": "🟤",
     "prompt": _fx("Cover the vehicle with realistic thick mud splatters and dirt streaks across the body, wheels and windows, like an off-road movie scene.", _OBJECT_LOCK)},
    {"id": "rust", "name": "Rust", "emoji": "🦀",
     "prompt": _fx("Add realistic aged rust patches and corrosion across the body panels, wheel arches and edges, keeping the vehicle shape intact.", _OBJECT_LOCK)},
    {"id": "burned_paint", "name": "Burned Paint", "emoji": "🔥",
     "prompt": _fx("Add realistic burned and blistered paint with soot marks and heat damage on the hood and doors, cinematic action movie style.", _OBJECT_LOCK)},
    {
        "id": "police_chase",
        "name": "Police Chase Damage",
        "emoji": "🚨",
        "prompt": _fx(
            "Create a highly realistic Hollywood police-chase aftermath "
            "automotive SFX effect on the existing vehicle photograph. "
            "Preserve the exact vehicle, its make, model, body shape, "
            "proportions, color, wheels, tires, windows, mirrors, headlights, "
            "taillights, badges and license plate. "

            "Make the vehicle look like it has just escaped a high-speed "
            "movie chase with realistic exterior damage. Add multiple "
            "collision-related scratches, scuff marks, scraped paint and "
            "localized dents across several body panels. "

            "Add realistic damage to appropriate areas such as the front "
            "bumper, rear bumper, fenders, doors and side panels. Vary the "
            "severity so some damage is minor while several areas are clearly "
            "visible and significant. "

            "Add long directional scratches and paint-transfer marks suggesting "
            "contact with another vehicle, a barrier or roadside object. Include "
            "smaller random scratches and scuffs around the main impact areas. "

            "Add realistic dirt, dust, road grime and subtle tire or rubber "
            "scuff marks around some damaged areas, as if the vehicle has been "
            "driven aggressively through a dusty road or urban environment. "

            "Add a few believable cracks or damaged exterior plastic components "
            "where appropriate, but do not make every light or panel damaged. "
            "Keep the vehicle structurally recognizable and visually believable. "

            "Use realistic reflections, shadows, metallic paint texture and "
            "panel deformation consistent with the original photograph. "
            "The result should look like a real photograph from an action movie "
            "after a dangerous car chase. "

            "Create varied damage patterns and avoid repetitive artificial "
            "textures. Damage must follow the physical geometry of the existing "
            "vehicle and remain consistent with the original perspective. "

            "ABSOLUTELY DO NOT change or replace the vehicle. Do not change "
            "its make, model, color, wheels, tires, windows, license plate, "
            "badges, background, road, buildings, people, camera angle, "
            "perspective, composition or lighting. Do not add police cars, "
            "weapons, explosions or other vehicles. Do not redesign the car. "
            "Only add realistic chase-related scratches, dents, scuffs, "
            "paint damage and localized exterior damage to the existing vehicle. "

            "Photorealistic professional automotive VFX, realistic collision "
            "damage, physically believable materials, accurate reflections "
            "and shadows, seamless integration and high-resolution cinematic detail."
        ),
    },
    {
        "id": "car_accident",
        "name": "Car Accident",
        "emoji": "💥",
        "prompt": _fx(
            "Create a highly realistic Hollywood automotive accident SFX effect "
            "on the existing vehicle photograph. Preserve the exact vehicle, "
            "its make, model, body shape, proportions, color, wheels, tires, "
            "windows, mirrors, headlights, taillights, badges and license plate. "

            "Make the vehicle look like it has recently been involved in a "
            "realistic road accident. Add several believable areas of body "
            "damage including dents, scraped paint, scuff marks and localized "
            "panel deformation. "

            "Add realistic collision damage to appropriate exterior areas such "
            "as the bumper, fenders, doors, hood and side panels. Damage should "
            "vary in severity: some areas lightly scratched and others visibly "
            "dented or scraped. "

            "Add multiple realistic scratches of different lengths and depths, "
            "paint transfer marks, scuffed paint and exposed underlying material "
            "where appropriate. Include subtle dirt, dust and road debris around "
            "the damaged areas. "

            "Add realistic cracks or damage to selected headlights or exterior "
            "plastic components only where physically appropriate. Do not make "
            "every component damaged. Keep the accident believable. "

            "The damaged panels should have realistic reflections, shadows, "
            "surface deformation and automotive paint texture consistent with "
            "the original lighting. Make the result look like a real photograph "
            "of the same vehicle after a serious but believable collision. "

            "Use varied damage patterns and avoid duplicated or artificial-looking "
            "textures. The accident damage should be clearly visible at first "
            "glance but remain physically plausible. "

            "ABSOLUTELY DO NOT replace, redesign or regenerate the vehicle. "
            "Do not change the vehicle model, color, wheels, tires, windows, "
            "license plate, badges, background, road, buildings, people, "
            "camera angle, perspective, composition or lighting. "
            "Do not add another vehicle. Do not remove parts of the vehicle "
            "unless the damage naturally implies a small localized deformation. "
            "Only modify the existing vehicle by adding realistic collision "
            "damage, dents, scratches, scuffs and paint damage. "

            "Photorealistic professional automotive VFX, physically believable "
            "collision damage, realistic reflections and shadows, seamless "
            "integration with the original photograph and high-resolution "
            "cinematic detail."
        ),
    },
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
                return {
                    **e,
                    "category": cat["id"],
                    "premium_tier": "free" if e["id"] == "police_chase" else cat["premium_tier"],
                }
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
                {
                    "id": e["id"],
                    "name": e["name"],
                    "emoji": e["emoji"],
                    "premium_tier": (
                        "free"
                        if e["id"] == "police_chase"
                        else cat["premium_tier"]
                    ),
                }
                for e in cat["effects"]
            ],
        }
        for cat in CATEGORIES
    ]
