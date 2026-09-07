export const effectCategories = {
  en: {
    all: "All",
    face: "Face",
    vehicle: "Vehicle",
    house: "House",
    object: "Object",
  },
  ru: {
    all: "Все",
    face: "Лицо",
    vehicle: "Автомобили",
    house: "Дома",
    object: "Объекты",
  },
  de: {
    all: "Alle",
    face: "Gesicht",
    vehicle: "Fahrzeuge",
    house: "Häuser",
    object: "Objekte",
  },
} as const;

export const effectNames = {
  en: {
    // FACE
    movie_bruises: "Movie Bruises",
    black_eye: "Black Eye",
    swollen_face: "Swollen Face",
    bandages: "Bandages",
    action_hero: "Action Movie Hero",
    zombie: "Zombie Makeup",
    pirate_scar: "Pirate Scar",
    comic_fight: "Comic Fight",
    monster_attack: "Monster Attack",
    vampire_bite: "Vampire Bite",
    alien_attack: "Alien Attack",
    robot_damage: "Robot Damage",
    fire_burn: "Fire Burn FX",
    ice_damage: "Ice Damage",
    magic_explosion: "Magic Explosion",
    paintball: "Paintball",
    cake_smash: "Cake Smash",
    food_fight: "Food Fight",
    funny_makeup: "Funny Makeup",
    hollywood_fx: "Hollywood FX",

    // VEHICLE
    broken_windshield: "Broken Windshield",
    heavy_scratches: "Heavy Scratches",
    mud: "Mud",
    rust: "Rust",
    burned_paint: "Burned Paint",
    police_chase: "Police Chase Damage",
    car_accident: "Car Accident",
    apocalypse_car: "Apocalypse Car",
    monster_truck: "Monster Truck Damage",
    abandoned_car: "Old Abandoned Car",
    flood_car: "Flood Damage",
    comic_crash: "Comic Crash",
    movie_explosion: "Movie Explosion FX",

    // HOUSE
    destroyed_wall: "Destroyed Wall",
    broken_windows: "Broken Windows",
    house_flood: "Flood Damage",
    house_fire: "Fire Damage",
    haunted_house: "Old Haunted House",
    jungle_house: "Jungle House",
    snow_house: "Snow Covered House",
    post_apocalypse: "Post Apocalypse",
    hollywood_explosion: "Hollywood Explosion FX",
    abandoned_building: "Abandoned Building",

    // OBJECT
    cinematic_phone: "Cinematic Phone",
    cinematic_laptop: "Cinematic Laptop",
    cinematic_tv: "Cinematic TV",
    cinematic_motorcycle: "Cinematic Motorcycle",
    cinematic_boat: "Cinematic Boat",
    cinematic_bicycle: "Cinematic Bicycle",
    cinematic_furniture: "Cinematic Furniture",
    cinematic_electronics: "Cinematic Electronics",
  },

  ru: {
    // FACE
    movie_bruises: "Синяки",
    black_eye: "Фингал",
    swollen_face: "Опухшее лицо",
    bandages: "Бинты",
    action_hero: "Герой боевика",
    zombie: "Зомби-макияж",
    pirate_scar: "Шрам пирата",
    comic_fight: "Комический бой",
    monster_attack: "Атака монстра",
    vampire_bite: "Укус вампира",
    alien_attack: "Атака пришельца",
    robot_damage: "Повреждение робота",
    fire_burn: "Ожог от огня",
    ice_damage: "Ледяное повреждение",
    magic_explosion: "Магический взрыв",
    paintball: "Пейнтбол",
    cake_smash: "Торт в лицо",
    food_fight: "Битва едой",
    funny_makeup: "Смешной макияж",
    hollywood_fx: "Голливудский FX",

    // VEHICLE
    broken_windshield: "Разбитое лобовое стекло",
    heavy_scratches: "Сильные царапины",
    mud: "Грязь",
    rust: "Ржавчина",
    burned_paint: "Обгоревшая краска",
    police_chase: "Повреждения после погони",
    car_accident: "ДТП",
    apocalypse_car: "Постапокалиптический автомобиль",
    monster_truck: "Повреждение монстр-трака",
    abandoned_car: "Старый заброшенный автомобиль",
    flood_car: "Повреждения от наводнения",
    comic_crash: "Комическое ДТП",
    movie_explosion: "Взрыв в стиле кино",

    // HOUSE
    destroyed_wall: "Разрушенная стена",
    broken_windows: "Разбитые окна",
    house_flood: "Повреждения от наводнения",
    house_fire: "Повреждения от пожара",
    haunted_house: "Старый дом с привидениями",
    jungle_house: "Дом в джунглях",
    snow_house: "Дом под снегом",
    post_apocalypse: "Постапокалипсис",
    hollywood_explosion: "Голливудский взрыв",
    abandoned_building: "Заброшенное здание",

    // OBJECT
    cinematic_phone: "Кинематографический телефон",
    cinematic_laptop: "Кинематографический ноутбук",
    cinematic_tv: "Кинематографический телевизор",
    cinematic_motorcycle: "Кинематографический мотоцикл",
    cinematic_boat: "Кинематографическая лодка",
    cinematic_bicycle: "Кинематографический велосипед",
    cinematic_furniture: "Кинематографическая мебель",
    cinematic_electronics: "Кинематографическая электроника",
  },

  de: {
    // FACE
    movie_bruises: "Filmische Blutergüsse",
    black_eye: "Blaues Auge",
    swollen_face: "Geschwollenes Gesicht",
    bandages: "Verbände",
    action_hero: "Actionheld",
    zombie: "Zombie-Make-up",
    pirate_scar: "Piratennarbe",
    comic_fight: "Comic-Kampf",
    monster_attack: "Monsterangriff",
    vampire_bite: "Vampirbiss",
    alien_attack: "Alienangriff",
    robot_damage: "Roboterschaden",
    fire_burn: "Feuerverbrennung",
    ice_damage: "Eisschaden",
    magic_explosion: "Magische Explosion",
    paintball: "Paintball",
    cake_smash: "Tortenschlacht",
    food_fight: "Essensschlacht",
    funny_makeup: "Lustiges Make-up",
    hollywood_fx: "Hollywood FX",

    // VEHICLE
    broken_windshield: "Zerbrochene Windschutzscheibe",
    heavy_scratches: "Starke Kratzer",
    mud: "Schlamm",
    rust: "Rost",
    burned_paint: "Verbrannter Lack",
    police_chase: "Schäden nach einer Verfolgungsjagd",
    car_accident: "Autounfall",
    apocalypse_car: "Postapokalyptisches Fahrzeug",
    monster_truck: "Monstertruck-Schäden",
    abandoned_car: "Altes verlassenes Auto",
    flood_car: "Hochwasserschäden",
    comic_crash: "Comic-Unfall",
    movie_explosion: "Filmische Explosion",

    // HOUSE
    destroyed_wall: "Zerstörte Wand",
    broken_windows: "Zerbrochene Fenster",
    house_flood: "Hochwasserschäden",
    house_fire: "Brandschäden",
    haunted_house: "Altes Spukhaus",
    jungle_house: "Dschungelhaus",
    snow_house: "Verschneites Haus",
    post_apocalypse: "Postapokalypse",
    hollywood_explosion: "Hollywood-Explosion",
    abandoned_building: "Verlassenes Gebäude",

    // OBJECT
    cinematic_phone: "Filmisches Smartphone",
    cinematic_laptop: "Filmischer Laptop",
    cinematic_tv: "Filmischer Fernseher",
    cinematic_motorcycle: "Filmisches Motorrad",
    cinematic_boat: "Filmisches Boot",
    cinematic_bicycle: "Filmisches Fahrrad",
    cinematic_furniture: "Filmische Möbel",
    cinematic_electronics: "Filmische Elektronik",
  },
} as const;

export const effectDisplayNames = {
  en: {
    cinematic_phone: "Phone FX",
    cinematic_laptop: "Laptop FX",
    cinematic_tv: "TV FX",
    cinematic_motorcycle: "Moto FX",
    cinematic_boat: "Boat FX",
    cinematic_bicycle: "Bike FX",
    cinematic_furniture: "Furniture FX",
    cinematic_electronics: "Electronics FX",
  },

  ru: {
    cinematic_phone: "Телефон FX",
    cinematic_laptop: "Ноутбук FX",
    cinematic_tv: "TV FX",
    cinematic_motorcycle: "Мото FX",
    cinematic_boat: "Лодка FX",
    cinematic_bicycle: "Велосипед FX",
    cinematic_furniture: "Мебель FX",
    cinematic_electronics: "Электроника FX",
  },

  de: {
    cinematic_phone: "Handy FX",
    cinematic_laptop: "Laptop FX",
    cinematic_tv: "TV FX",
    cinematic_motorcycle: "Moto FX",
    cinematic_boat: "Boot FX",
    cinematic_bicycle: "Fahrrad FX",
    cinematic_furniture: "Möbel FX",
    cinematic_electronics: "Elektronik FX",
  },
} as const;

export function getEffectDisplayName(
  id: string,
  lang: keyof typeof effectDisplayNames,
  fallback: string,
): string {
  return (
    effectDisplayNames[lang][
      id as keyof typeof effectDisplayNames.en
    ] ?? fallback
  );
}

export type EffectNameKey = keyof typeof effectNames.en;
export type EffectCategoryKey = keyof typeof effectCategories.en;

export function getEffectName(
  id: string,
  lang: keyof typeof effectNames,
  fallback: string
): string {
  return effectNames[lang][id as EffectNameKey] ?? fallback;
}

export function getEffectCategoryName(
  category: string,
  lang: keyof typeof effectCategories,
  fallback: string
): string {
  return (
    effectCategories[lang][category as EffectCategoryKey] ?? fallback
  );
}