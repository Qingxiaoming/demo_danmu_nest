export enum PLATFORM {
  platform = 'platform',
  
  h5 = 'h5',
}

export enum CoatingType {
  POWDER = 'powder', // 粉末涂装
  ELECTROPHORESIS = 'electrophoresis', // 电泳涂装
  POWDER_ELECTRO = 'powder_electro', // 电泳+粉末涂装
  WATER_PAINT = 'water_paint', // 水性漆
  OIL_PAINT = 'oil_paint', // 油性漆
}

export enum ProductionLineType {
  POWDER = '粉末涂装',
  ELECTROPHORESIS = '电泳涂装',
  ELECTROPHORESIS_POWDER = '电泳+粉末涂装',
  WATER_PAINT = '水性漆涂装',
  OIL_PAINT = '油性漆涂装',
}

export enum RateType {
  DAY = '每天',
  WEEK = '每周',
  MONTH = '每月',
  TWOMONTH = '每两月',
  SEMESTER = '每半年',
}

export enum InspectionType {
  ONE = '辅助检查',
  TWO = '设备检查',
  THREE = '5s',
  FOUR = '烤炉系统',
  FIVE = '传动系统',
  SIX = '废水',
  SEVEN = '前处理设备',
  EIGHT = '前处理槽液',
}

export enum ResultMethod {
  ONE = '数值',
  TWO = '图片',
  THREE = '文字',
}
