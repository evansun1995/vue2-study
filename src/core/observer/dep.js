/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
/**
 * dep是一个可被观察的对象 ，它可以有多个指令去订阅它
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    // subs 是订阅的监听器集合
    this.subs = []
  }

  // 添加监听器到 subs 中
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    // slice 拷贝
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    // subs 是 观察者（Watcher）的集合，循环去派发更新
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
} 

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// 当前目标观察者正在被计算
// target是全局独一无二的，因为同一时刻只有一个观察者会被计算
// 这个对象是 watcher 的实例，在 触发实例的 get 方法时，会将 Dep.target 设置为实例本身
// 然后调用 getter 函数，getter 函数中触发响应对象的 getter，从而触发依赖收集
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  // console.log(this)
  // debugger
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
