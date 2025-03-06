const E = {
  /*------ 通用错误码 1000~9999 ------*/
  UNDEFINED: { error: 1000, message: '未定义异常' },
  INVALID_PARAMS: { error: 1001, message: '参数异常' },
  API_ERROR: { error: 1002, message: '接口异常' },
  TODO: { error: 1003, message: '功能开发中' },
  ONLY_DEVELOPMENT: { error: 1004, message: '仅开发模式可用' },

  // USER AUTH
  AUTH_FAILED: { error: 2001, message: '无效验证', statusCode: 401 },
  INVALID_PASSWORD: { error: 2002, message: '密码错误' },
  USER_EXISTS: { error: 2003, message: '账号已经存在' },
  USER_NOT_EXISTS: { error: 2004, message: '账号不存在' },
  USER_ROLE_NO_PRIVILEGE: { error: 2005, message: '操作权限不足' },
  USER_OR_PASSWORD_ERROR: { error: 2006, message: '账号或密码错误' },
  INVALID_RENEWPASSWORD: { error: 2007, message: '新密码确认失败' },
  USER_DISABLED: { error: 2009, message: '账号禁用' },

  // RESTFUL
  RESTFUL_GET_ID: { error: 3001, message: '查询数据不存在' },
  RESTFUL_DELETE_ID: { error: 3002, message: '删除数据不存在' },
  RESTFUL_UPDATE_ID: { error: 3003, message: '更新数据不存在' },
  RESTFUL_DUPLICATION: { error: 3004, message: '数据已经存在' },
  RESTFUL_TODO: { error: 3005, message: '该接口未实现' },
  RESTFUL_HAS_DELETED: { error: 3006, message: '该数据已被删除' },
  RESTFUL_GET_AUTH: { error: 3007, message: '该权限不存在' },

  // SQL
  SQL_DUPLICATION: { error: 4001, message: '数据已经存在' },
  SQL_INCOMPLETE_PARAMS: { error: 4002, message: '错误，参数不全' },
  SQL_INSERT_FAILED: { error: 4003, message: '插入数据失败' },

  /*------ 业务错误码 10000~19999 ------*/
  // ...TODO

};

export default E;
