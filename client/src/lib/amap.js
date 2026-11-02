let loading = null;

export function loadAmap() {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_AMAP_KEY;
    const security = import.meta.env.VITE_AMAP_SECURITY_CODE;
    if (!key) {
      reject(new Error('未配置 VITE_AMAP_KEY'));
      return;
    }
    window._AMapSecurityConfig = { securityJsCode: security };
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`;
    script.async = true;
    script.onload = () => resolve(window.AMap);
    script.onerror = () => {
      loading = null;
      reject(new Error('高德地图脚本加载失败'));
    };
    document.head.appendChild(script);
  });

  return loading;
}
