// Netlify Function: the content & photo API behind /api/* and /media/*.
//
// Production and test deploys get SEPARATE data (see server/stores.mjs):
// a Deploy Preview can never change or delete the live website's photos,
// projects, settings or password.
import { getStore } from '@netlify/blobs'
import { purgeCache } from '@netlify/functions'
import { createApp } from '../../server/app.mjs'
import { netlifyStores, resolveDataEnv, storeNames } from '../../server/stores.mjs'

const apps = {}

function appFor(dataEnv) {
  return (apps[dataEnv] ||= createApp({
    stores: netlifyStores(getStore, { dataEnv }),
    env: process.env,
    dataEnv,
    // The content tag differs per data environment, so publishing on a
    // preview only refreshes the preview's cached content.
    contentCacheTag: storeNames(dataEnv).content,
    purgeContentCache: () => purgeCache({ tags: [storeNames(dataEnv).content] }),
  }))
}

export default async (req, context) => {
  const deployContext = context?.deploy?.context || globalThis.Netlify?.context?.deploy?.context || ''
  const dataEnv = resolveDataEnv(deployContext, process.env)
  return appFor(dataEnv)(req, { ip: context?.ip })
}

export const config = { path: ['/api/*', '/media/*'] }
