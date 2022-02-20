/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf' // 调用浏览器 window.performance API 相关代码
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

// 实例唯一标识，自增
let uid = 0

// Component 类型是在 '/flow/component.js'中定义的flow检验的类型
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    /* 
    performance 性能监控相关处理
     *performance 默认是false，开启要手动设置为true，如下：
     *Vue.config.performance = true 
     */
    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) { // 非生产环境，且开启性能监控，且支持 performance API
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // 搜了一下，这个属性避免 vue 监听实例自身
    vm._isVue = true
    // Options API 的处理逻辑，会将配置的属性统一存储在 $options 中
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation  优化内部组件实例化
      // since dynamic options merging is pretty slow, and none of the  因为动态选项合并非常慢，同时
      // internal component options needs special treatment.  所有的内部组件选项都不需要特殊处理
      // 这里应该是特殊判断组件，做优化处理
      // 组件会直接将 options 挂载到 vm.$options 上
      initInternalComponent(vm, options)
    } else {
      // 如果是根组件的处理，合并 Vue 的全局配置到根组件的局部配置
      // mixins、extends 中的属性在 mergeOptions 方法中特殊处理了
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // 非生产环境给特殊属性做代理，给报错提示
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    // vm._self === vm  结果是 true
    // 可能是为了方便特殊场景获取实例自身？
    vm._self = vm
    /**
     * 初始化声明周期方法
     * 提供组件更新(_update)、组件挂载、组件更新 等api
     * 提供 $destory、$forceUpdate 等api
     */
    initLifecycle(vm)
    /**
     * $on、$off、$once、$emit 方法的定义与挂载
     */
    initEvents(vm)
    /**
     * $slots、$scopedSlots 设置
     * $attrs、$listeners 设置
     */
    initRender(vm)
    // beforeCreate生命周期
    // 此时无法获取inject、data、computed等
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    // 依次处理 props、methods、data、computed、watch
    initState(vm)
    // provide支持函数写法，统一处理成对象形式
    initProvide(vm) // resolve provide after data/props
    // created 生命周期
    // beforeCreate 和 created 生命周期在同一个宏任务中（_init方法），按顺序同步执行
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
    console.log(vm)
  }
}

// 初始化内部组件时执行，这里主要是给 vm.$options 赋值
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    // 搜了下教程，这里是判断如果存在基类，递归解析基类构造函数的选项
    // 应该是为了支持 Vue.extend 的写法
    // 在 '/src/core/global-api/extend.js' 中有 super 的赋值
    // 代码： Sub['super'] = Super
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      // 说明基类构造函数选项已经发生改变，需要重新设置
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      // 检查 Ctor.options 上是否有任何后期修改/附加的选项
      // 循环对比值，找出 修改/新增 的 属性
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        // 有不同就合并
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      // 这里把组件本身存到components中，可能是为了支持组件递归调用
      // 试了一下，组件确实是支持递归调用自身的，不需要在 components 中声明
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
