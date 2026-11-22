import path from 'node:path'
import { defineConfig } from '@tarojs/cli'
export default defineConfig({
 projectName: 'photography-academy', date: '2026-11-14',
 designWidth: 750, deviceRatio: {750: 1}, sourceRoot: 'src', outputRoot: 'dist',
 framework: 'react', compiler: {type: 'webpack5', prebundle: {enable: false}},
 plugins: ['@tarojs/plugin-platform-weapp',path.resolve(__dirname,'a11y-plugin.cjs')], mini: {compile: {include: [path.resolve(__dirname, '../../../packages/photography-core')]}}, h5: {}
})
