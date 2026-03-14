export const VER = 'v11';

export const SK = 'ascent_v11';

export const DINERS = [
  {id:'me',   label:'Me',    s:'M',  c:'#c9a040'},
  {id:'wife', label:'Wife',  s:'W',  c:'#56c49a'},
  {id:'kid1', label:'Kid 1', s:'K1', c:'#5ba4cf'},
  {id:'kid2', label:'Kid 2', s:'K2', c:'#f07ab0'},
];

export const MDR = [
  {id:'Cosmopolitan',short:'COSMO', c:'#5b9bd4'},
  {id:'Cyprus',      short:'CYPRUS',c:'#d4735b'},
  {id:'Normandie',   short:'NORM.', c:'#d4b55b'},
  {id:'Tuscan',      short:'TUSCAN',c:'#b87cc4'},
];

export const BUFFET = [
  {id:'Oceanview Café',short:'O.CAFÉ',c:'#7aab9e'},
  {id:'Mast Grill',    short:'MAST',  c:'#a99b6a'},
];

export const SPECIALTY = [
  {id:'Fine Cut Steakhouse',          c:'#d45b5b'},
  {id:'Eden Restaurant',              c:'#5bd48a'},
  {id:'Le Voyage by Daniel Boulud',   c:'#9b70d4'},
  {id:'Raw on 5 Sushi',               c:'#d45b9b'},
  {id:'Le Grand Bistro w Petite Chef',c:'#d4a45b'},
  {id:'Rooftop Garden Grill',         c:'#5bd4b0'},
];

export const ALL_V = [...MDR, ...BUFFET, ...SPECIALTY];

export const BASE_EXCL = {
  Cosmopolitan:{
    s:[{n:'Cauliflower Flan',v:1},{n:'Salmon Gravlax',v:1},{n:'Yellow Corn Soup',v:1}],
    e:[{n:'Spaghetti à la Mallorquín',v:1},{n:'Oxtail Royale',v:1},{n:'Pan-Seared Cod',v:1}],
    d:[{n:'Carrot Cake',v:1}],
  },
  Cyprus:{
    s:[{n:'Lentil Soup',v:1},{n:'Mezze Board',v:1},{n:'Grilled Octopus',v:1}],
    e:[{n:'Braised Lamb Shanks',v:1},{n:'Cypriot Short Ribs',v:1},{n:'Kordelia Pasta',v:1}],
    d:[{n:'Galaktoboureko',v:1}],
  },
  Normandie:{
    s:[{n:'Turkey Terrine',v:1},{n:'Coquilles Saint-Jacques',v:1},{n:'Baked Brie',v:1}],
    e:[{n:'Beef en Croûte',v:1},{n:'Marmite Dieppoise',v:1},{n:'Seared Duck Breast',v:1}],
    d:[{n:'Millefeuille',v:1}],
  },
  Tuscan:{
    s:[{n:'Roasted Pumpkin Salad',v:1},{n:'Creamy Tuscan Shrimp Soup',v:1},{n:'Eggplant Caponata Bruschetta',v:1}],
    e:[{n:'Slow Roasted Herbed Tuscan Pork Chop',v:1},{n:'Pappardelle Alla Veneziana',v:1},{n:'Strozzapreti Carbonara',v:1}],
    d:[{n:'Cannoli',v:1}],
  },
  TBD:{
    s:[],
    e:[],
    d:[],
  },
};

export const BASE_CLS = {
  s:['Classic Caesar Salad','Chilled Shrimp Cocktail','Escargots à la Bourguignonne','French Onion Soup'],
  e:['Aged Prime Rib of Beef','Creamy Corn Farrotto','Broiled Salmon','Grilled Chicken Breast','Grilled New York Sirloin Steak'],
  d:['Apple Pie à la Mode','Crème Brûlée','Chocolate Cake','Low Fat Frozen Yogurt','Ice Cream','Vanilla Ice Cream','Sorbet'],
};

export const DEFAULT_SIG = [
  // Night 1 Mar 16
  {s:[{n:'Arugula Salad',v:1},{n:'Warm Goat Cheese Croustillant',v:1}],
   e:[{n:'Atlantic Pollock',v:1},{n:'Chicken Chiquita',v:1},{n:'Aged Prime Rib of Beef',v:1},{n:'Creamy Corn Farrotto',v:1},{n:'Duo of Pork',v:1}],
   d:[{n:'Biscuit Croustillant',v:1},{n:'Sticky Toffee Pudding',v:1}]},
  // Night 2 Mar 17
  {s:[{n:'Tomato Watermelon Salad',v:1},{n:'Salmon Tartare',v:1}],
   e:[{n:'Seared Duck',v:1},{n:'Steak Diane',v:1},{n:'Stuffed Portobello Mushroom',v:1},{n:'Grilled Lamb T-Bone',v:1},{n:'Grilled Cobia',v:1}],
   d:[{n:'Strawberry Ice Cream',v:1},{n:'Warm Apple Crumble a la Mode',v:1}]},
  // Night 3 Mar 18
  {s:[{n:'Garden Fresh Salad',v:1},{n:'Asian Consommé',v:1}],
   e:[{n:'Roasted Trout',v:1},{n:'Lemon-Pepper Roasted Chicken',v:1},{n:'Roasted Pork Loin',v:1},{n:'Fried Masala Potatoes',v:1},{n:'Pan-Seared Aged Sirloin Steak',v:1}],
   d:[{n:'Butter Pecan Ice Cream',v:1},{n:'Warm Chocolate Lava Cake',v:1},{n:'Panna Cotta Alla Romana',v:1}]},
  // Night 4 Mar 19
  {s:[{n:'Beef Carpaccio',v:1},{n:'Cream of Broccoli',v:1}],
   e:[{n:'Cajun-Spiced Drum Fish',v:1},{n:'Oven-Roasted Chicken Saltimbocca',v:1},{n:'Roasted Pork Loin',v:1},{n:'Barolo-Braised Beef Short Ribs',v:1},{n:'Vegetable Korma',v:1}],
   d:[{n:'Apple Tarte Tatin',v:1},{n:'Olive Oil Cremeux',v:1}]},
  // Night 5 Mar 20
  {s:[{n:'Chop Chop Composed Salad',v:1},{n:'Spinach Turnover',v:1}],
   e:[{n:'Sautéed Tilapia Filet',v:1},{n:'Oven-Roasted Turkey',v:1},{n:'Pork Scaloppini Marsala',v:1},{n:'Homemade Gnocchi ai Quattro Formaggi',v:1},{n:'Grilled Flank Steak',v:1}],
   d:[{n:'Sacher Torte',v:1},{n:'Whipped Passionfruit Curd',v:1}]},
  // Night 6 Mar 21
  {s:[{n:'Mesclun Greens',v:1},{n:'Smoked Ham & Split-Pea Soup',v:1}],
   e:[{n:'Broiled Australian Sea Bass',v:1},{n:'Crispy Chicken Roulade',v:1},{n:'Moroccan-Spiced Lamb Kebab',v:1},{n:'Beef Bourguignonne',v:1},{n:'Pappardelle con Funghi',v:1}],
   d:[{n:'Bananas Foster',v:1},{n:'Cafe Pot de Creme',v:1}]},
  // Night 7 Mar 22
  {s:[{n:'Cured Atlantic Salmon',v:1},{n:'Cream of Chicken',v:1}],
   e:[{n:'Almond-Crusted Hake',v:1},{n:'Pan-Seared Duck Breast',v:1},{n:'Tender Braised Veal',v:1},{n:'Beef Brochette',v:1},{n:'Vegetable Wellington',v:1}],
   d:[{n:'Fraisier Sweet Strawberry Cake',v:1},{n:'Warm Chocolate Lava Cake',v:1}]},
  // Night 8 Mar 23
  {s:[{n:'The Wedge Salad',v:1},{n:'Pasta Fagioli Soup',v:1}],
   e:[{n:'Seared Branzino',v:1},{n:'Turkey Parmesan',v:1},{n:'Rigatoni Boscaiola',v:1},{n:'Steak and Chips',v:1},{n:'Toasted Israeli Couscous Cake',v:1}],
   d:[{n:'Tiramisu',v:1},{n:'Strawberry Angel Food Cake',v:1}]},
  // Night 9 Mar 24
  {s:[{n:'Arugula and Mixed Green Salad',v:1},{n:'Creamy Smoked Tomato Bisque',v:1}],
   e:[{n:'Herb-Crusted Haddock Fillet',v:1},{n:'Broiled Lobster Tail',v:1},{n:'Beef Wellington',v:1},{n:'Creamy Wild Mushroom Risotto',v:1},{n:'Slow-Roasted Leg of Lamb',v:1}],
   d:[{n:'Celebrity Signature Baked Alaska',v:1},{n:'Citrus Roulade',v:1}]},
  // Night 10 Mar 25
  {s:[{n:'Organic Roasted Red Beets',v:1},{n:'Cream of Wild Forest Mushroom Soup',v:1}],
   e:[{n:'Oven-Roasted Jerk Spiced Chicken',v:1},{n:'Spinach & Ricotta Ravioli',v:1},{n:'Seared Salmon',v:1},{n:'Home-Style Pork Chop',v:1},{n:'Aged Prime Rib of Beef',v:1}],
   d:[{n:'New York Cheesecake',v:1},{n:'Chocolate Cherry Trifle',v:1}]}
];

export const DATES = ['Mar 16','Mar 17','Mar 18','Mar 19','Mar 20','Mar 21','Mar 22','Mar 23','Mar 24','Mar 25'];

export const CAT_LBL = {s:'Starters',e:'Entrées',d:'Desserts'};

export const CAT_ICO = {s:'🥗',e:'🍽',d:'🍮'};