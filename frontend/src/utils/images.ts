/**
 * Effect thumbnail images. Uses cinematic Unsplash sources for premium look.
 * Categories map to hero images, and each specific effect uses a unique image.
 */
export const CATEGORY_HERO: Record<string, string> = {
  face: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
  vehicle: "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=800&q=80",
  house: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80",
  object: "https://images.unsplash.com/photo-1588281345136-9893252095bd?w=800&q=80",
};

export const EFFECT_THUMBS: Record<string, string> = {
  // Face
  movie_bruises: "https://images.unsplash.com/photo-1520975916090-3105956dac38?w=600&q=70",
  black_eye: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=600&q=70",
  bandages: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=600&q=70",
  swollen_face: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=70",
  action_hero: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600&q=70",
  zombie: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=600&q=70",
  pirate_scar: "https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?w=600&q=70",
  comic_fight: "https://images.unsplash.com/photo-1531214288907-6d2d7b18c1eb?w=600&q=70",
  monster_attack: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=600&q=70",
  vampire_bite: "https://images.unsplash.com/photo-1509909756405-be0199881695?w=600&q=70",
  alien_attack: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=70",
  robot_damage: "https://images.unsplash.com/photo-1535378620166-273708d44e4c?w=600&q=70",
  fire_burn: "https://images.unsplash.com/photo-1523875194681-bedd468c58bf?w=600&q=70",
  ice_damage: "https://images.unsplash.com/photo-1518983546435-91f8b87fe561?w=600&q=70",
  magic_explosion: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=70",
  paintball: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&q=70",
  cake_smash: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=600&q=70",
  food_fight: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=70",
  funny_makeup: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=70",
  hollywood_fx: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=70",
  // Vehicle
  broken_windshield: "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=600&q=70",
  heavy_scratches: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=70",
  mud: "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=600&q=70",
  rust: "https://images.unsplash.com/photo-1449426468159-d96dbf34635?w=600&q=70",
  burned_paint: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600&q=70",
  police_chase: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&q=70",
  apocalypse_car: "https://images.unsplash.com/photo-1519666336592-e225a99dcd2f?w=600&q=70",
  monster_truck: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&q=70",
  abandoned_car: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=600&q=70",
  flood_car: "https://images.unsplash.com/photo-1600661653561-629509216228?w=600&q=70",
  comic_crash: "https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=600&q=70",
  movie_explosion: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&q=70",
  // House
  destroyed_wall: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=600&q=70",
  broken_windows: "https://images.unsplash.com/photo-1519643381401-22c77e60520e?w=600&q=70",
  house_flood: "https://images.unsplash.com/photo-1580223530509-070ec3d80984?w=600&q=70",
  house_fire: "https://images.unsplash.com/photo-1523294587484-bae6cc870010?w=600&q=70",
  haunted_house: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=600&q=70",
  jungle_house: "https://images.unsplash.com/photo-1571055107559-3e67626fa8be?w=600&q=70",
  snow_house: "https://images.unsplash.com/photo-1418985227700-036b8b4be3ef?w=600&q=70",
  post_apocalypse: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=70",
  hollywood_explosion: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&q=70",
  abandoned_building: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=600&q=70",
  // Object
  cinematic_phone: "https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=600&q=70",
  cinematic_laptop: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=70",
  cinematic_tv: "https://images.unsplash.com/photo-1461151304267-38535e780c79?w=600&q=70",
  cinematic_motorcycle: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&q=70",
  cinematic_boat: "https://images.unsplash.com/photo-1493558103817-58b2924bce98?w=600&q=70",
  cinematic_bicycle: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&q=70",
  cinematic_furniture: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=600&q=70",
  cinematic_electronics: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=70",
};

export function getEffectThumb(effectId: string, category?: string): string {
  return EFFECT_THUMBS[effectId] || (category ? CATEGORY_HERO[category] : CATEGORY_HERO.face);
}

/** Turns base64 (no scheme) into a data URI usable in <Image />. */
export function toDataUri(base64: string, mime = "image/png"): string {
  if (!base64) return "";
  if (base64.startsWith("data:")) return base64;
  return `data:${mime};base64,${base64}`;
}
