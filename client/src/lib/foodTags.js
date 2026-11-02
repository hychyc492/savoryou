// 店铺美食标签：按店名与高德分类做关键词归类，供搜索与筛选复用
const RULES = [
  ['米饭', /米饭|盖饭|盖浇饭|炒饭|煲仔饭|便当|黄焖鸡|排骨饭|卤肉饭|鸡腿饭|石锅拌饭|盒饭/],
  ['面食', /拉面|牛肉面|刀削面|烩面|担担面|炸酱面|热干面|拌面|汤面|炒面|焖面|凉面|意面|面馆|面食|馄饨|水饺|饺子|锅贴|包子|馒头|肉夹馍/],
  ['粉', /米线|米粉|粉丝|螺蛳粉|酸辣粉|河粉|炒粉|宽粉/],
  ['火锅', /火锅|麻辣烫|串串|冒菜|干锅|麻辣香锅/],
  ['烧烤', /烧烤|烤肉|烤串|烤鱼|铁板烧|撸串/],
  ['炸鸡汉堡', /炸鸡|鸡排|汉堡|肯德基|KFC|塔斯汀|必胜客|披萨|pizza|德克士|华莱士|麦当劳/],
  ['咖啡', /咖啡|瑞幸|库迪|幸运咖/],
  ['饮品', /饮品|冷饮|奶茶|茶饮|果茶|鲜茶|果汁|蜜雪冰城|甜啦啦|茶艺馆/],
  ['甜品', /甜品|蛋糕|烘焙|糕饼|面包|甜点|冰淇淋|冰激凌|泡芙|布丁/],
  ['小吃', /小吃|炸串|炸|煎|烤肠|卤味|鸭脖|粥|锅盔|饼|凉皮|臭豆腐/],
  ['炒菜', /中餐厅|正餐|川菜|湘菜|粤菜|东北菜|鲁菜|西北菜|家常菜|炒菜|饭店|酒楼|食府|私房菜|大排档/],
  ['清真', /清真/],
];

export const FOOD_TAGS = [...RULES.map(([name]) => name), '其他'];

/** 评价一键标签，与 server/src/index.js 的白名单保持一致，每条评价最多选 3 个 */
export const REVIEW_TAGS = ['好吃', '份量足', '性价比高', '上菜快', '环境干净', '有点辣', '要排队', '有点咸'];

// 关键词 → 标签的别名，命中后按标签匹配（例如搜“奶茶”能筛出“饮品”店）
const KEYWORD_ALIASES = {
  米饭: ['米饭', '盖饭', '盒饭', '炒饭', '便当', '饭'],
  面食: ['面条', '面', '拉面', '刀削面', '饺子', '馄饨', '包子'],
  粉: ['粉', '米线', '米粉', '粉丝', '螺蛳粉'],
  火锅: ['火锅', '麻辣烫', '串串', '冒菜', '干锅'],
  烧烤: ['烧烤', '烤肉', '烤串', '烤鱼', '撸串'],
  炸鸡汉堡: ['炸鸡', '汉堡', '鸡排', '披萨', '快餐'],
  咖啡: ['咖啡'],
  饮品: ['饮品', '奶茶', '果茶', '茶饮', '冷饮', '饮料'],
  甜品: ['甜品', '甜点', '蛋糕', '面包', '烘焙', '冰淇淋'],
  小吃: ['小吃', '夜宵', '炸串', '煎饼', '粥'],
  炒菜: ['炒菜', '家常菜', '川菜', '湘菜', '正餐'],
  清真: ['清真'],
};

const tagCache = new WeakMap();

export function tagsOf(item) {
  if (!item) return [];
  if (tagCache.has(item)) return tagCache.get(item);
  const dishes = (item.dishes || []).map((d) => `${d.name || ''} ${d.stall || ''}`).join(' ');
  const hay = `${item.name || ''} ${item.category || ''} ${dishes}`;
  const tags = RULES.filter(([, re]) => re.test(hay)).map(([name]) => name);
  const result = tags.length ? tags : ['其他'];
  tagCache.set(item, result);
  return result;
}

function aliasTag(term) {
  for (const [tag, words] of Object.entries(KEYWORD_ALIASES)) {
    if (words.some((w) => w === term || w.includes(term) || term.includes(w))) return tag;
  }
  return null;
}

/** 关键词按空格分词，全部命中才算匹配；支持店名、分类、标签与食堂菜品名 */
export function matchKeyword(item, keyword) {
  const terms = String(keyword || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return true;

  const tags = tagsOf(item);
  const hay = [
    item.name,
    item.category,
    tags.join(' '),
    ...(item.dishes || []).map((d) => `${d.name || ''} ${d.stall || ''}`),
  ]
    .join(' ')
    .toLowerCase();

  return terms.every((term) => {
    if (hay.includes(term)) return true;
    const alias = aliasTag(term);
    return alias != null && tags.includes(alias);
  });
}

export function filterItems(items, { keyword = '', tags = [], costMax = null } = {}) {
  return items.filter((item) => {
    if (costMax != null && !(item.amapCost != null && item.amapCost <= costMax)) return false;
    if (!matchKeyword(item, keyword)) return false;
    if (tags.length && !tags.some((tag) => tagsOf(item).includes(tag))) return false;
    return true;
  });
}

/** 各标签在当前关键词 / 预算条件下还能筛出多少家（不把已选标签算进去） */
export function facetCounts(items, { keyword = '', costMax = null } = {}) {
  const base = items.filter(
    (item) =>
      matchKeyword(item, keyword) &&
      (costMax == null || (item.amapCost != null && item.amapCost <= costMax))
  );
  const counts = {};
  for (const tag of FOOD_TAGS) counts[tag] = 0;
  for (const item of base) {
    for (const tag of tagsOf(item)) counts[tag] += 1;
  }
  return counts;
}
