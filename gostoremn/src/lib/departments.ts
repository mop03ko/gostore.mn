import type { IconName } from "@/components/shop-ui";
type Department = { name: string; query: string; icon: IconName; color: string; terms: { label: string; query: string; icon: IconName }[] };
export const departments: Department[] = [
  {
    "name": "Хувцас",
    "query": "clothing",
    "icon": "shirt",
    "color": "#fff0ed",
    "terms": [
      {
        "label": "Эмэгтэй",
        "query": "Women clothing",
        "icon": "dress"
      },
      {
        "label": "Эрэгтэй",
        "query": "Men clothing",
        "icon": "shirt"
      },
      {
        "label": "Гадуур хувцас",
        "query": "Jacket",
        "icon": "shirt"
      },
      {
        "label": "Цамц",
        "query": "Sweater",
        "icon": "shirt"
      },
      {
        "label": "Жийнс",
        "query": "Jeans",
        "icon": "pants"
      },
      {
        "label": "Даашинз",
        "query": "Dress",
        "icon": "dress"
      }
    ]
  },
  {
    "name": "Гутал",
    "query": "shoes",
    "icon": "shoe",
    "color": "#fff4df",
    "terms": [
      {
        "label": "Пүүз",
        "query": "Sneakers",
        "icon": "shoe"
      },
      {
        "label": "Гүйлтийн",
        "query": "Running shoes",
        "icon": "shoe"
      },
      {
        "label": "Түрийтэй",
        "query": "Boots",
        "icon": "shoe"
      },
      {
        "label": "Өдөр тутмын",
        "query": "Loafers",
        "icon": "shoe"
      },
      {
        "label": "Сандаал",
        "query": "Sandals",
        "icon": "shoe"
      },
      {
        "label": "Хүүхдийн",
        "query": "Kids shoes",
        "icon": "shoe"
      }
    ]
  },
  {
    "name": "Цүнх",
    "query": "bag",
    "icon": "bag",
    "color": "#ffeee8",
    "terms": [
      {
        "label": "Гар цүнх",
        "query": "Handbag",
        "icon": "bag"
      },
      {
        "label": "Үүргэвч",
        "query": "Backpack",
        "icon": "bag"
      },
      {
        "label": "Мөрний цүнх",
        "query": "Shoulder bag",
        "icon": "bag"
      },
      {
        "label": "Аяллын",
        "query": "Travel bag",
        "icon": "bag"
      },
      {
        "label": "Түрийвч",
        "query": "Wallet",
        "icon": "wallet"
      },
      {
        "label": "Даавуун цүнх",
        "query": "Tote bag",
        "icon": "bag"
      }
    ]
  },
  {
    "name": "Гэр ахуй",
    "query": "home storage",
    "icon": "home",
    "color": "#eaf6f0",
    "terms": [
      {
        "label": "Хадгалах хайрцаг",
        "query": "Storage box",
        "icon": "box"
      },
      {
        "label": "Орны хэрэглэл",
        "query": "Bedding",
        "icon": "bed"
      },
      {
        "label": "Гал тогоо",
        "query": "Kitchen organizer",
        "icon": "grid"
      },
      {
        "label": "Гэрэлтүүлэг",
        "query": "Lamp",
        "icon": "lamp"
      },
      {
        "label": "Тавилга",
        "query": "Desk",
        "icon": "home"
      },
      {
        "label": "Угаалгын өрөө",
        "query": "Bathroom organizer",
        "icon": "bottle"
      }
    ]
  },
  {
    "name": "Технологи",
    "query": "electronics",
    "icon": "headphones",
    "color": "#eaf0ff",
    "terms": [
      {
        "label": "Чихэвч",
        "query": "Headphones",
        "icon": "headphones"
      },
      {
        "label": "Гар",
        "query": "Keyboard",
        "icon": "keyboard"
      },
      {
        "label": "Хулгана",
        "query": "Mouse",
        "icon": "mouse"
      },
      {
        "label": "Утасны гэр",
        "query": "Phone case",
        "icon": "phone"
      },
      {
        "label": "Цэнэглэгч",
        "query": "Charger",
        "icon": "phone"
      },
      {
        "label": "Ухаалаг цаг",
        "query": "Smartwatch",
        "icon": "watch"
      }
    ]
  },
  {
    "name": "Гоо сайхан",
    "query": "beauty",
    "icon": "beauty",
    "color": "#ffebf3",
    "terms": [
      {
        "label": "Гоо сайхны цүнх",
        "query": "Makeup bag",
        "icon": "bag"
      },
      {
        "label": "Багс",
        "query": "Makeup brush",
        "icon": "brush"
      },
      {
        "label": "Толь",
        "query": "Mirror",
        "icon": "mirror"
      },
      {
        "label": "Үсний хэрэгсэл",
        "query": "Hair accessories",
        "icon": "beauty"
      },
      {
        "label": "Хумсны хэрэгсэл",
        "query": "Nail accessories",
        "icon": "beauty"
      },
      {
        "label": "Үнэртний сав",
        "query": "Perfume bottle",
        "icon": "bottle"
      }
    ]
  },
  {
    "name": "Хүүхэд",
    "query": "kids clothing",
    "icon": "child",
    "color": "#fff3de",
    "terms": [
      {
        "label": "Хүүхдийн хувцас",
        "query": "Kids clothing",
        "icon": "shirt"
      },
      {
        "label": "Нярайн хувцас",
        "query": "Baby clothes",
        "icon": "child"
      },
      {
        "label": "Сурагчийн цүнх",
        "query": "School bag",
        "icon": "bag"
      },
      {
        "label": "Хүүхдийн гутал",
        "query": "Kids shoes",
        "icon": "shoe"
      },
      {
        "label": "Нярайн хөнжил",
        "query": "Baby blanket",
        "icon": "bed"
      },
      {
        "label": "Малгай",
        "query": "Kids hat",
        "icon": "hat"
      }
    ]
  },
  {
    "name": "Спорт",
    "query": "sports",
    "icon": "ball",
    "color": "#fff0e4",
    "terms": [
      {
        "label": "Иог",
        "query": "Yoga mat",
        "icon": "child"
      },
      {
        "label": "Спорт цүнх",
        "query": "Sports bag",
        "icon": "bag"
      },
      {
        "label": "Спорт хувцас",
        "query": "Fitness clothing",
        "icon": "shirt"
      },
      {
        "label": "Сагсан бөмбөг",
        "query": "Basketball",
        "icon": "ball"
      },
      {
        "label": "Усны сав",
        "query": "Water bottle",
        "icon": "bottle"
      },
      {
        "label": "Аяллын хэрэгсэл",
        "query": "Camping",
        "icon": "home"
      }
    ]
  },
  {
    "name": "Тоглоом",
    "query": "toys",
    "icon": "toy",
    "color": "#f1ecff",
    "terms": [
      {
        "label": "Эвлүүлдэг",
        "query": "Building blocks",
        "icon": "box"
      },
      {
        "label": "Эвлүүлдэг зураг",
        "query": "Puzzle",
        "icon": "grid"
      },
      {
        "label": "Чихмэл",
        "query": "Plush toy",
        "icon": "child"
      },
      {
        "label": "Хөлөгт тоглоом",
        "query": "Board game",
        "icon": "toy"
      },
      {
        "label": "Машин",
        "query": "Toy car",
        "icon": "truck"
      },
      {
        "label": "Хүүхэлдэй",
        "query": "Doll",
        "icon": "child"
      }
    ]
  },
  {
    "name": "Аксессуар",
    "query": "accessories",
    "icon": "watch",
    "color": "#e9f6f5",
    "terms": [
      {
        "label": "Бугуйн цаг",
        "query": "Watch",
        "icon": "watch"
      },
      {
        "label": "Нарны шил",
        "query": "Sunglasses",
        "icon": "glasses"
      },
      {
        "label": "Бүс",
        "query": "Belt",
        "icon": "wallet"
      },
      {
        "label": "Малгай",
        "query": "Hat",
        "icon": "hat"
      },
      {
        "label": "Ороолт",
        "query": "Scarf",
        "icon": "shirt"
      },
      {
        "label": "Гоёлын хайрцаг",
        "query": "Jewelry box",
        "icon": "box"
      }
    ]
  }
];
export const brands = ["Nike", "adidas", "Puma", "New Balance", "UNIQLO", "ZARA", "H&M", "The North Face", "Sony", "Xiaomi", "LEGO", "IKEA"];
