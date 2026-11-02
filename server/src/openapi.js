/** OpenAPI 3.0 文档：既作为前后端契约，也用于 /api/docs 可视化调试 */

const shopSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    shortName: { type: 'string' },
    kind: { type: 'string', enum: ['canteen', 'campusShop', 'shop'] },
    group: { type: 'string', enum: ['campus', 'nearby'] },
    category: { type: 'string' },
    address: { type: 'string' },
    area: { type: 'string' },
    lng: { type: 'number' },
    lat: { type: 'number' },
    distance: { type: 'integer', nullable: true },
    amapRating: { type: 'number', nullable: true },
    amapCost: { type: 'integer', nullable: true },
    openHours: { type: 'string' },
    openSegments: { type: 'string' },
    tel: { type: 'string' },
    photo: { type: 'string' },
    photos: { type: 'array', items: { type: 'object' } },
    isFeatured: { type: 'boolean' },
    isOnCampus: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' } },
    rating: {
      type: 'object',
      properties: {
        score: { type: 'number', nullable: true },
        n: { type: 'integer' },
        base: { type: 'number', nullable: true },
        label: { type: 'string' },
      },
    },
  },
};

const envelope = (dataSchema, metaSchema) => ({
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    data: dataSchema,
    ...(metaSchema ? { meta: metaSchema } : {}),
  },
});

const errorResponse = {
  description: '错误',
  content: { 'application/json': { schema: envelope({ type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } }) } },
};

const jsonBody = (schema) => ({ required: true, content: { 'application/json': { schema } } });
const okJson = (schema, meta) => ({ description: '成功', content: { 'application/json': { schema: envelope(schema, meta) } } });

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SavorU API',
    version: '1.0.0',
    description: '河科大美食地图 · 后端契约。成功返回 { ok:true, data, meta? }，失败返回 { ok:false, error:{ code, message } }。',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'auth', description: '认证与账号' },
    { name: 'shops', description: '店铺目录（目录已入库）' },
    { name: 'ratings', description: '评分（贝叶斯融合）' },
    { name: 'rankings', description: '榜单' },
    { name: 'stats', description: '统计' },
    { name: 'ugc', description: '评价 / 收藏 / 打卡' },
    { name: 'dishes', description: '菜品与提交' },
    { name: 'admin', description: '管理员' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: { Shop: shopSchema },
  },
  paths: {
    '/auth/register': {
      post: { tags: ['auth'], summary: '注册并登录', requestBody: jsonBody({ type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string' } } }), responses: { 200: okJson({ type: 'object', properties: { accessToken: { type: 'string' }, user: { type: 'object' } } }), 400: errorResponse } },
    },
    '/auth/login': {
      post: { tags: ['auth'], summary: '登录', requestBody: jsonBody({ type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string' } } }), responses: { 200: okJson({ type: 'object' }), 400: errorResponse } },
    },
    '/auth/refresh': {
      post: { tags: ['auth'], summary: '刷新 access（依赖 httpOnly Cookie savoru_rt）', responses: { 200: okJson({ type: 'object', properties: { accessToken: { type: 'string' }, user: { type: 'object' } } }), 401: errorResponse } },
    },
    '/auth/logout': { post: { tags: ['auth'], summary: '退出并撤销 refresh', responses: { 200: okJson({ type: 'object' }) } } },
    '/auth/me': { get: { tags: ['auth'], summary: '当前用户', security: [{ bearerAuth: [] }], responses: { 200: okJson({ type: 'object' }), 401: errorResponse } } },
    '/shops': {
      get: {
        tags: ['shops'], summary: '店铺列表（服务端筛选 + 融合分）',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'scope', in: 'query', schema: { type: 'string', enum: ['campus', 'nearby'] } },
          { name: 'kind', in: 'query', schema: { type: 'string', enum: ['canteen', 'campusShop', 'shop'] } },
          { name: 'area', in: 'query', schema: { type: 'string' } },
          { name: 'tags', in: 'query', schema: { type: 'string' }, description: '逗号分隔，OR 关系' },
          { name: 'costMax', in: 'query', schema: { type: 'integer' } },
          { name: 'featured', in: 'query', schema: { type: 'boolean' } },
          { name: 'open', in: 'query', schema: { type: 'boolean' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['rating', 'popular', 'value', 'distance'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { 200: okJson({ type: 'array', items: { $ref: '#/components/schemas/Shop' } }, { type: 'object', properties: { total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' } } }) },
      },
    },
    '/shops/map': {
      get: { tags: ['shops'], summary: '地图视口查询', parameters: [{ name: 'bbox', in: 'query', schema: { type: 'string' }, description: 'minLng,minLat,maxLng,maxLat' }], responses: { 200: okJson({ type: 'array', items: { type: 'object' } }) } },
    },
    '/shops/{id}': {
      get: { tags: ['shops'], summary: '店铺详情（含菜品与评价）', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: okJson({ $ref: '#/components/schemas/Shop' }), 404: errorResponse } },
    },
    '/ratings': {
      get: { tags: ['ratings'], summary: '批量融合分', parameters: [{ name: 'ids', in: 'query', schema: { type: 'string' }, description: '逗号分隔，最多 200 个' }], responses: { 200: okJson({ type: 'object', additionalProperties: { type: 'object' } }) } },
    },
    '/rankings': {
      get: { tags: ['rankings'], summary: '榜单', parameters: [{ name: 'scope', in: 'query', schema: { type: 'string', enum: ['campus', 'nearby'] } }, { name: 'by', in: 'query', schema: { type: 'string', enum: ['rating', 'popular', 'value'] } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }], responses: { 200: okJson({ type: 'array', items: { $ref: '#/components/schemas/Shop' } }) } },
    },
    '/stats/overview': { get: { tags: ['stats'], summary: '站点规模与新鲜度', responses: { 200: okJson({ type: 'object' }) } } },
    '/tags': { get: { tags: ['stats'], summary: '美食标签清单', responses: { 200: okJson({ type: 'object' }) } } },
    '/reviews': {
      get: { tags: ['ugc'], summary: '评价列表', parameters: [{ name: 'targetId', in: 'query', schema: { type: 'string' } }], responses: { 200: okJson({ type: 'array', items: { type: 'object' } }) } },
    },
    '/reviews/{targetId}': {
      put: { tags: ['ugc'], summary: '提交/更新评价（一店一人一条）', security: [{ bearerAuth: [] }], parameters: [{ name: 'targetId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: jsonBody({ type: 'object', required: ['rating'], properties: { rating: { type: 'integer', minimum: 1, maximum: 5 }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } }), responses: { 200: okJson({ type: 'object' }), 401: errorResponse } },
      delete: { tags: ['ugc'], summary: '删除我的评价', security: [{ bearerAuth: [] }], parameters: [{ name: 'targetId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: okJson({ type: 'object' }) } },
    },
    '/favorites': { get: { tags: ['ugc'], summary: '我的收藏 id 列表', security: [{ bearerAuth: [] }], responses: { 200: okJson({ type: 'object' }) } } },
    '/favorites/{targetId}': {
      put: { tags: ['ugc'], summary: '收藏', security: [{ bearerAuth: [] }], parameters: [{ name: 'targetId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: okJson({ type: 'object' }) } },
      delete: { tags: ['ugc'], summary: '取消收藏', security: [{ bearerAuth: [] }], parameters: [{ name: 'targetId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: okJson({ type: 'object' }) } },
    },
    '/checkins/stats': { get: { tags: ['ugc'], summary: '打卡统计', parameters: [{ name: 'targetId', in: 'query', schema: { type: 'string' } }], responses: { 200: okJson({ type: 'object' }) } } },
    '/checkins/mine': { get: { tags: ['ugc'], summary: '我的打卡与连续天数', security: [{ bearerAuth: [] }], responses: { 200: okJson({ type: 'object' }) } } },
    '/checkins': { post: { tags: ['ugc'], summary: '打卡（一人一天一店一次）', security: [{ bearerAuth: [] }], requestBody: jsonBody({ type: 'object', required: ['targetId'], properties: { targetId: { type: 'string' } } }), responses: { 200: okJson({ type: 'object' }) } } },
    '/checkins/{targetId}': { delete: { tags: ['ugc'], summary: '取消今日打卡', security: [{ bearerAuth: [] }], parameters: [{ name: 'targetId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: okJson({ type: 'object' }) } } },
    '/dishes': { get: { tags: ['dishes'], summary: '菜品列表', parameters: [{ name: 'restaurantId', in: 'query', schema: { type: 'string' } }], responses: { 200: okJson({ type: 'array', items: { type: 'object' } }) } } },
    '/submissions': { post: { tags: ['dishes'], summary: '提交新菜品（待审）', security: [{ bearerAuth: [] }], requestBody: jsonBody({ type: 'object', required: ['restaurantId', 'name'], properties: { restaurantId: { type: 'string' }, name: { type: 'string' }, price: { type: 'integer', nullable: true }, stall: { type: 'string' }, spicy: { type: 'integer', minimum: 0, maximum: 3 }, mealSlots: { type: 'array', items: { type: 'string' } }, tags: { type: 'array', items: { type: 'string' } } } }), responses: { 200: okJson({ type: 'object' }), 401: errorResponse } } },
    '/submissions/mine': { get: { tags: ['dishes'], summary: '我的提交', security: [{ bearerAuth: [] }], responses: { 200: okJson({ type: 'array', items: { type: 'object' } }) } } },
    '/admin/submissions': { get: { tags: ['admin'], summary: '待审核列表', security: [{ bearerAuth: [] }], responses: { 200: okJson({ type: 'array', items: { type: 'object' } }) } } },
    '/admin/submissions/{id}': { patch: { tags: ['admin'], summary: '审核（approve/reject）', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: jsonBody({ type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['approve', 'reject'] }, note: { type: 'string' } } }), responses: { 200: okJson({ type: 'object' }) } } },
    '/admin/dishes': {
      get: { tags: ['admin'], summary: '菜品管理列表', security: [{ bearerAuth: [] }], responses: { 200: okJson({ type: 'array', items: { type: 'object' } }) } },
      post: { tags: ['admin'], summary: '新增菜品（直接发布）', security: [{ bearerAuth: [] }], responses: { 200: okJson({ type: 'object' }) } },
    },
    '/admin/dishes/{id}': { delete: { tags: ['admin'], summary: '删除菜品', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: okJson({ type: 'object' }) } } },
    '/migrate': { post: { tags: ['auth'], summary: '迁移本地收藏/评价到账号', security: [{ bearerAuth: [] }], responses: { 200: okJson({ type: 'object' }) } } },
  },
};