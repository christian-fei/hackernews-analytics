const test = require('ava')
const db = require('../lib/db')
// const items50000 = require('./fixtures/items.50000.json')
const distinctTitles = require('./fixtures/distinct-titles.json')
const calculateNlpData = require('../lib/calculate-nlp-data')

// test.beforeEach(async () => {
//   console.time('-> removing "items" collection')
//   await db.get('items').remove({})
//   console.timeEnd('-> removing "items" collection')
//   console.time('-> inserting 50000 docs in "items" collection')
//   await db.get('items').insert(items50000)
//   console.timeEnd('-> inserting 50000 docs in "items" collection')
// })

test('contains nlp results', async t => {
  const data = await calculateNlpData({ titles: distinctTitles })
  t.truthy(data)
  t.true(Array.isArray(data.titles))
  console.log('-> data.people', JSON.stringify(data.people))
  t.true(Array.isArray(data.nouns))
  t.true(Array.isArray(data.people))
  t.true(Array.isArray(data.numbers))
  t.truthy(data.numbersOccurency)
})
