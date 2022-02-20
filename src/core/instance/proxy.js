/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'

let initProxy

if (process.env.NODE_ENV !== 'production') {
  // allowedGlobals：校验全局变量的方法，是个 Function
  // 应该是模板引擎解析时候用的
  // 毕竟 template 中使用不需要加 this.xxx
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,' +
    'require' // for Webpack/Browserify
  )

  // 这是开发环境最常见的提示，使用了 属性/方法，但是没有在组件内声明~
  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
      'referenced during render. Make sure that this property is reactive, ' +
      'either in the data option, or for class-based components, by ' +
      'initializing the property. ' +
      'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }

  // 为了避免和 Vue 实例中的内置属性冲突
  // 以"$"或"_"开头的属性或方法，需要通过"vm.$data.xxx"的形式访问
  // 如果直接通过 vm 访问会报下面的错
  const warnReservedPrefix = (target, key) => {
    warn(
      `Property "${key}" must be accessed with "$data.${key}" because ` +
      'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
      'prevent conflicts with Vue internals. ' +
      'See: https://vuejs.org/v2/api/#data',
      target
    )
  }

  // 判断浏览器支持 Proxy 对象
  const hasProxy =
    typeof Proxy !== 'undefined' && isNative(Proxy)

  if (hasProxy) {
    // 支持的内置修饰符map
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')
    config.keyCodes = new Proxy(config.keyCodes, {
      // 劫持配置中的keyCodes，禁止重写内置修饰符
      set (target, key, value) {
        if (isBuiltInModifier(key)) {
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
          return false
        } else {
          target[key] = value
          return true
        }
      }
    })
  }

  const hasHandler = {
    // handler.has() 方法是针对 in 操作符的代理方法
    has (target, key) {
      const has = key in target
      const isAllowed = allowedGlobals(key) ||
        (typeof key === 'string' && key.charAt(0) === '_' && !(key in target.$data))
        // 如果 key 不在 vm 实例上，且不是全局变量
      if (!has && !isAllowed) {
        // Vue不会将"$"或"_"开头的属性或方法代理到实例上
        // 因此声明的属性或方法只会在 vm.$data 中
        // 也只能通过 vm.$data 的形式访问
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return has || !isAllowed
    }
  }

  const getHandler = {
    get (target, key) {
      if (typeof key === 'string' && !(key in target)) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  initProxy = function initProxy (vm) {
    // 如果浏览器支持 Proxy 对象
    if (hasProxy) {
      // determine which proxy handler to use
      // 通常情况都走 hasHandler
      // 全局搜了下，只有单元测试中会把 _withStripped 设置为 true
      // 这里 hasHandler 只是对 has 方法做了拦截，不是 vm.$data 等上的属性的映射
      const options = vm.$options
      const handlers = options.render && options.render._withStripped
      ? getHandler
      : hasHandler
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      // 不支持就直接用 vm 实例了，只是少了提示信息，不影响使用
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
