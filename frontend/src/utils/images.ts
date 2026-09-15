/**
 * Effect thumbnails.
 *
 * Every effect has a bundled WebP showing the applied result. Category
 * heroes are still remote and are only used by onboarding.
 */
import { ImageSourcePropType } from "react-native";

const LOCAL_EFFECT_THUMBS: Record<string, ImageSourcePropType> = {
  movie_bruises: require("@/assets/effects/movie_bruises.webp"),
  black_eye: require("@/assets/effects/black_eye.webp"),
  bandages: require("@/assets/effects/bandages.webp"),
  swollen_face: require("@/assets/effects/swollen_face.webp"),
  action_hero: require("@/assets/effects/action_hero.webp"),
  zombie: require("@/assets/effects/zombie.webp"),
  pirate_scar: require("@/assets/effects/pirate_scar.webp"),
  comic_fight: require("@/assets/effects/comic_fight.webp"),
  monster_attack: require("@/assets/effects/monster_attack.webp"),
  vampire_bite: require("@/assets/effects/vampire_bite.webp"),
  alien_attack: require("@/assets/effects/alien_attack.webp"),
  food_fight: require("@/assets/effects/food_fight.webp"),
  robot_damage: require("@/assets/effects/robot_damage.webp"),
  cake_smash: require("@/assets/effects/cake_smash.webp"),
  fire_burn: require("@/assets/effects/fire_burn.webp"),
  ice_damage: require("@/assets/effects/ice_damage.webp"),
  magic_explosion: require("@/assets/effects/magic_explosion.webp"),
  paintball: require("@/assets/effects/paintball.webp"),
  funny_makeup: require("@/assets/effects/funny_makeup.webp"),
  hollywood_fx: require("@/assets/effects/hollywood_fx.webp"),
  broken_windshield: require("@/assets/effects/broken_windshield.webp"),
  heavy_scratches: require("@/assets/effects/heavy_scratches.webp"),
  mud: require("@/assets/effects/mud.webp"),
  rust: require("@/assets/effects/rust.webp"),
  burned_paint: require("@/assets/effects/burned_paint.webp"),
  police_chase: require("@/assets/effects/police_chase.webp"),
  apocalypse_car: require("@/assets/effects/apocalypse_car.webp"),
  monster_truck: require("@/assets/effects/monster_truck.webp"),
  abandoned_car: require("@/assets/effects/abandoned_car.webp"),
  flood_car: require("@/assets/effects/flood_car.webp"),
  comic_crash: require("@/assets/effects/comic_crash.webp"),
  movie_explosion: require("@/assets/effects/movie_explosion.webp"),
  car_accident: require("@/assets/effects/car_accident.webp"),
  destroyed_wall: require("@/assets/effects/destroyed_wall.webp"),
  broken_windows: require("@/assets/effects/broken_windows.webp"),
  house_flood: require("@/assets/effects/house_flood.webp"),
  house_fire: require("@/assets/effects/house_fire.webp"),
  haunted_house: require("@/assets/effects/haunted_house.webp"),
  jungle_house: require("@/assets/effects/jungle_house.webp"),
  snow_house: require("@/assets/effects/snow_house.webp"),
  post_apocalypse: require("@/assets/effects/post_apocalypse.webp"),
  hollywood_explosion: require("@/assets/effects/hollywood_explosion.webp"),
  abandoned_building: require("@/assets/effects/abandoned_building.webp"),
  cinematic_phone: require("@/assets/effects/cinematic_phone.webp"),
  cinematic_laptop: require("@/assets/effects/cinematic_laptop.webp"),
  cinematic_tv: require("@/assets/effects/cinematic_tv.webp"),
  cinematic_motorcycle: require("@/assets/effects/cinematic_motorcycle.webp"),
  cinematic_boat: require("@/assets/effects/cinematic_boat.webp"),
  cinematic_bicycle: require("@/assets/effects/cinematic_bicycle.webp"),
  cinematic_furniture: require("@/assets/effects/cinematic_furniture.webp"),
  cinematic_electronics: require("@/assets/effects/cinematic_electronics.webp"),
};

export const CATEGORY_HERO: Record<string, string> = {
  face: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
  vehicle: "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=800&q=80",
  house: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80",
  object: "https://images.unsplash.com/photo-1588281345136-9893252095bd?w=800&q=80",
};

/**
 * Remote fallback for an effect with no bundled preview.
 *
 * Every effect currently ships a local WebP, so this only fires if the
 * backend catalogue gains an id before the artwork lands. It is not
 * exported: the old per-effect Unsplash table it used to read from showed
 * stock photos of untouched subjects, which is the opposite of what a
 * preview is for.
 */
function categoryFallback(category?: string): string {
  return category ? CATEGORY_HERO[category] ?? CATEGORY_HERO.face : CATEGORY_HERO.face;
}

export function getEffectThumbSource(
  effectId: string,
  category?: string
): number | { uri: string } {
  const local = LOCAL_EFFECT_THUMBS[effectId];

  if (local) {
    return local as number;
  }

  return {
    uri: categoryFallback(category),
  };
}

/** Turns base64 (no scheme) into a data URI usable in <Image />. */
export function toDataUri(base64: string, mime = "image/png"): string {
  if (!base64) return "";
  if (base64.startsWith("data:")) return base64;
  return `data:${mime};base64,${base64}`;
}