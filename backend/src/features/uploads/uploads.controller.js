import * as service from './uploads.service.js'
import { prisma } from '../../lib/prisma.js'
import { created } from '../../utils/response.js'

export async function uploadPropertyImage(req, res, next) {
  try {
    const url = await service.uploadPropertyImageSet(req.file, req.user.id)
    created(res, { url })
  } catch (err) { next(err) }
}

export async function uploadAvatar(req, res, next) {
  try {
    const url = await service.uploadSingle(req.file, req.user.id, 'avatars', 512, 80)
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } })
    created(res, { url })
  } catch (err) { next(err) }
}

export async function uploadChatImage(req, res, next) {
  try {
    const url = await service.uploadSingle(req.file, req.user.id, 'chat', 1280, 78)
    created(res, { url })
  } catch (err) { next(err) }
}
