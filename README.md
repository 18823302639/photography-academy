# Photography Academy 摄影练习小程序

微信小程序原型，使用 Taro、React 和 TypeScript。底部有练习、照片、记录三个入口。照片与 EXIF 在设备本地读取；练习点评使用 Mock，不上传照片或调用真实 AI。FastAPI 原型位于 `services/api`，预览小程序不需要启动后端。

## 本地开发

使用 Node.js 24，在仓库根目录运行：

```sh
npm ci
npm test
npm run typecheck
npm run build:weapp
```

在微信开发者工具导入 `apps/miniprogram`，配置指向构建生成的 `dist/`。真机视觉与原生相册流程待验收。有需要时，使用 `tests/fixtures` 的合成测试图。
