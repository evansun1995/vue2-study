/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

// 设置flag值
export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
/**
 * 观察者类依附于每个被观察的对象
 * 一旦依附上，观察者会转化目标对象的属性键的getter/setter方法
 * 从而进行收集依赖和派发更新
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 给 value 自身添加观察者对象
    def(value, '__ob__', this)
    // 如果是数组
    if (Array.isArray(value)) {
      // 1. 首先重写数组的7个api
      // 判断对象是否有__proto__，可能会有低版本浏览器不支持？
      if (hasProto) {
        // 重写数组的__proto__，对几个API做响应式处理
        protoAugment(value, arrayMethods)
      } else {
        // 不支持 __proto__，就通过Object.defineProperty劫持数组的方法
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 2. 给数组的子集添加观察者
      // vue 不会给数组的下标添加观察者，但是会向下递归，遇到对象就添加观察者
      this.observeArray(value)
    } else {
      // observe 方法实例化 Observer 时做了判断，确保了 value 是个数组 或 其他类型对象
      // walk 方法内循环给对象上的每个属性添加观察者
      // 处理时如果属性对应的值是个对象或数组，会再次走到这里，从而实现递归给后代的每一个对象属性添加观察者
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
/**
 * 返回一个值（对象）的观察者对象实例
 * 如果不存在就新创建，否则返回已存在的观察者实例
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
// 响应式处理核心方法，劫持set、get 方法
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // dep 是用来做依赖收集的，有target、subs两个关键属性
  const dep = new Dep()
  // 获取一个对象上的自有属性，包括：value、writable、enumerable、configurable
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 如果该属性不可修改
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 迎合预定义的 getter/setters
  const getter = property && property.get
  const setter = property && property.set
  // 如果不存在 getter 或者存在 setter，同时没有指定 value
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // shallow 为 true，表示浅度监听
  // 这里如果 val 不是对象 或者是 vNode，childOb 将会是 undefined
  // 这里是在初始化时生成的 childOb，所以只有预定义时 val 是个对象时才会处理下级节点的依赖
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 兼容定义 get 函数的写法，最常见的是 computed 中定义的 get 、 set
      const value = getter ? getter.call(obj) : val
      // callHook、initData、$watch 等方法执行时，都会设置 Dep.target 的值
      // 同一时间段只会处理一个 Dep.target
      if (Dep.target) {
        // 依赖收集，将当前调用自身的 watcher 实例添加到依赖中
        dep.depend()
        if (childOb) {
          // 如果 value 是个 对象或数组，继续做依赖收集
          childOb.dep.depend()
          if (Array.isArray(value)) {
            // 递归给后代节点做依赖收集
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // 意思是访问器属性没有 setter？
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
