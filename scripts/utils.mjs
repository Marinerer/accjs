import fg from 'fast-glob'
import fs from 'fs-extra'
import { MODULES } from './const.mjs'

/**
 * 所有模块及对应路径
 */
export const modulesMap = fg.sync(MODULES, { absolute: false }).reduce((acc, cur) => {
	const arr = cur.split('/')
	if (arr.length === 3) {
		acc[arr[1]] = arr.slice(0, 2).join('/')
	}
	return acc
}, {})

/**
 * 获取指定库 package.json
 * @param {string[]|string} libs 库文件名
 * @returns
 */
export async function getPackage(libs) {
	let pkgs = []
	if (libs && [].concat(libs).length) {
		pkgs = libs.map((name) => `${modulesMap[name]}/package.json`)
	} else {
		pkgs = Object.values(modulesMap).map((p) => `${p}/package.json`)
	}

	if (pkgs.length) {
		return Promise.all(pkgs.map((p) => fs.readJSON(p)))
	}
	return []
}

/**
 * cli 参数转换处理
 * @param {object} args 参数对象
 * @param {string} type 输出类型
 * @returns
 */
export function toArgs(args = {}, type = 'string') {
	const results = Object.entries(args)
		.filter(([key, value]) => key !== '_' && value !== false)
		.map(([key, value]) => {
			if (value === true) {
				return `--${key}`
			} else {
				return `--${key}=${value}`
			}
		})

	return type === 'string' ? results.join(' ') : results
}
