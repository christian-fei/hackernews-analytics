#!/usr/bin/env node

const { browser: { createBrowser, preparePage }, queue: { createQueue } } = require('mega-scraper')
const logger = require('pino')()
const path = require('path')
const monk = require('monk')
const db = monk(process.env.MONGO_URI || 'mongodb://localhost:27017/hackernews')
const itemsColl = db.get('items')
const fsp = require('fs').promises
const createServer = require('./lib/create-server')
const extractInfoFromPage = require('./lib/extract-info-from-page')

main()

async function main () {
  const browser = await createBrowser({ headless: true, incognito: true })
  const queue = createQueue('hackernews')
  const server = await createServer({ port: +process.env.PORT || +process.env.HTTP_PORT || 5000 })

  logger.info('creating index')
  await itemsColl.createIndex({
    id: 1,
    title: 1,
    page: 1,
    rank: 1,
    link: 1,
    score: 1,
    age: 1,
    commentCount: 1
  }, { unique: true })

  await run()
  setInterval(async () => {
    logger.info('running')
    await run()
  }, 1000 * 60 * 2)
  queue.on('stalled', async (job) => {
    logger.info('discard stalled job', job.id, job.data)
    await job.discard()
  })
  queue.process(4, processJob)

  async function processJob (job, done) {
    logger.info('processing', job.id, job.data)
    job.progress(10)
    let page = await browser.newPage(job.data.url, { reusePage: false })
    await new Promise((resolve) => setTimeout(resolve, 1000))
    job.progress(20)
    page = await preparePage(page, { proxy: true, blocker: true, images: true, stylesheets: true, javascript: true })
    job.progress(30)

    await page.waitForSelector('table')
    job.progress(50)

    const content = await page.content()
    job.progress(70)

    if (/not able to serve your/gi.test(content)) {
      await page.close()
      await job.progress(100)
      await job.moveToFailed(new Error('blocked'))
      throw new Error('blocked')
    }

    await job.progress(80)

    const { ids, titles, links, scores, ages, ranks, commentCounts } = await extractInfoFromPage(page)

    await page.close()

    logger.info('success', job.id, job.data.url)
    const pageNumber = +job.data.url.replace(/\D/gi, '')
    logger.info('pageNunber', pageNumber)
    const items = titles.map((_, i) => ({
      id: ids[i],
      title: titles[i],
      page: pageNumber,
      rank: ranks[i],
      link: links[i],
      score: scores[i],
      age: ages[i],
      commentCount: commentCounts[i],
      updated: new Date().toISOString()
    }))

    await fsp.mkdir(path.resolve(__dirname, 'data'), { recursive: true })
    await fsp.mkdir(path.resolve(__dirname, 'data', job.data.url, '..'), { recursive: true })
    await fsp.writeFile(path.resolve(__dirname, 'data', `${job.data.url}.json`), JSON.stringify(items, null, 2))

    await job.progress(100)

    server.update(({ data, log }) => {
      data[pageNumber] = items
      if (log.length >= 10) log.splice(0, 1)
      log.push(`scraped content on page ${pageNumber}\t @ ${new Date().toISOString()}`)
    })

    for (const item of items) {
      await itemsColl.insert(item)
        .then(() => logger.info('inserted', item.title, item.url))
        .catch((err) => logger.info('unchanged', item.title, item.url, err.message))
    }

    done(null, items)
  }

  async function run () {
    await queue.add({ url: 'https://news.ycombinator.com/news?p=1' }, { attempts: 3 })
    await queue.add({ url: 'https://news.ycombinator.com/news?p=2' }, { attempts: 3 })
    await queue.add({ url: 'https://news.ycombinator.com/news?p=3' }, { attempts: 3 })
    await queue.add({ url: 'https://news.ycombinator.com/news?p=4' }, { attempts: 3 })
    await queue.add({ url: 'https://news.ycombinator.com/news?p=5' }, { attempts: 3 })
    await queue.add({ url: 'https://news.ycombinator.com/news?p=6' }, { attempts: 3 })
    await queue.add({ url: 'https://news.ycombinator.com/news?p=7' }, { attempts: 3 })
    await queue.add({ url: 'https://news.ycombinator.com/news?p=8' }, { attempts: 3 })
    await queue.add({ url: 'https://news.ycombinator.com/news?p=9' }, { attempts: 3 })
    await queue.add({ url: 'https://news.ycombinator.com/news?p=10' }, { attempts: 3 })
  }
}
