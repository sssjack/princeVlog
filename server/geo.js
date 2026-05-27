import geoip from 'geoip-lite';

const CN_REGIONS = {
  '11': '北京',
  '12': '天津',
  '13': '河北',
  '14': '山西',
  '15': '内蒙古',
  '21': '辽宁',
  '22': '吉林',
  '23': '黑龙江',
  '31': '上海',
  '32': '江苏',
  '33': '浙江',
  '34': '安徽',
  '35': '福建',
  '36': '江西',
  '37': '山东',
  '41': '河南',
  '42': '湖北',
  '43': '湖南',
  '44': '广东',
  '45': '广西',
  '46': '海南',
  '50': '重庆',
  '51': '四川',
  '52': '贵州',
  '53': '云南',
  '54': '西藏',
  '61': '陕西',
  '62': '甘肃',
  '63': '青海',
  '64': '宁夏',
  '65': '新疆',
  '71': '台湾',
  '81': '香港',
  '82': '澳门',
  AH: '安徽',
  BJ: '北京',
  CQ: '重庆',
  FJ: '福建',
  GD: '广东',
  GS: '甘肃',
  GX: '广西',
  GZ: '贵州',
  HA: '河南',
  HB: '湖北',
  HE: '河北',
  HI: '海南',
  HK: '香港',
  HL: '黑龙江',
  HN: '湖南',
  JL: '吉林',
  JS: '江苏',
  JX: '江西',
  LN: '辽宁',
  MO: '澳门',
  NM: '内蒙古',
  NX: '宁夏',
  QH: '青海',
  SC: '四川',
  SD: '山东',
  SH: '上海',
  SN: '陕西',
  SX: '山西',
  TJ: '天津',
  TW: '台湾',
  XJ: '新疆',
  XZ: '西藏',
  YN: '云南',
  ZJ: '浙江'
};

const COUNTRY_NAMES = {
  CN: '中国',
  HK: '中国香港',
  MO: '中国澳门',
  TW: '中国台湾',
  US: '美国',
  JP: '日本',
  KR: '韩国',
  SG: '新加坡',
  GB: '英国',
  DE: '德国',
  FR: '法国',
  CA: '加拿大',
  AU: '澳大利亚',
  RU: '俄罗斯'
};

function isPrivateIp(ip) {
  return (
    !ip ||
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

export function normalizeIp(value) {
  const first = String(value || '').split(',')[0].trim();
  return first.replace(/^::ffff:/, '') || 'unknown';
}

function countryNameForCode(code) {
  const value = String(code || '').trim().toUpperCase();
  if (!value) return '未知';
  if (COUNTRY_NAMES[value]) return COUNTRY_NAMES[value];
  try {
    return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(value) || value;
  } catch {
    return value;
  }
}

export function locationForIp(ip) {
  const normalized = normalizeIp(ip);
  if (isPrivateIp(normalized)) {
    return { country: '本地/内网', province: '本地/内网' };
  }

  const geo = geoip.lookup(normalized);
  if (!geo) return { country: '未知', province: '未知' };

  const country = countryNameForCode(geo.country);
  if (geo.country === 'CN') {
    return {
      country,
      province: CN_REGIONS[geo.region] || geo.region || '中国'
    };
  }

  return {
    country,
    province: geo.region || country || '未知'
  };
}

export function provinceForIp(ip) {
  return locationForIp(ip).province;
}
