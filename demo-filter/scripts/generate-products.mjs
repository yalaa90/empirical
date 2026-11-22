import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderProductImage } from './product-images.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'src/data/products.json')
const imagesDir = resolve(root, 'public/products')

const COLORS = [
  { key: 'red', label: 'Red' },
  { key: 'blue', label: 'Blue' },
  { key: 'black', label: 'Black' },
  { key: 'white', label: 'White' },
  { key: 'green', label: 'Green' },
  { key: 'yellow', label: 'Yellow' },
]

const CATEGORIES = [
  {
    key: 'tshirt',
    label: 'T-Shirt',
    count: 25,
    brands: ['Northline', 'Basalt', 'Field & Form', 'Sunday Standard', 'Alder'],
    adjectives: ['Classic', 'Relaxed', 'Heavyweight', 'Pocket', 'Oversized'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    price: [22, 42],
    tags: ['casual', 'cotton', 'everyday'],
    blurb: 'soft combed cotton with a clean everyday cut',
  },
  {
    key: 'hoodie',
    label: 'Hoodie',
    count: 20,
    brands: ['Northline', 'Basalt', 'Rove', 'Alder'],
    adjectives: ['Fleece', 'Zip-Up', 'Pullover', 'Boxy', 'Heavyweight'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    price: [45, 89],
    tags: ['warm', 'layer', 'streetwear'],
    blurb: 'brushed fleece with a roomy hood and ribbed cuffs',
  },
  {
    key: 'shoes',
    label: 'Shoes',
    count: 20,
    brands: ['Terra', 'Vela', 'Rove', 'Strider', 'Northline'],
    adjectives: ['Trail', 'Court', 'Runner', 'Canvas', 'Low'],
    sizes: ['7', '8', '9', '10', '11', '12'],
    price: [55, 130],
    tags: ['footwear', 'comfort', 'outdoor'],
    blurb: 'cushioned footbed with a grippy everyday outsole',
  },
  {
    key: 'hat',
    label: 'Hat',
    count: 15,
    brands: ['Northline', 'Alder', 'Field & Form'],
    adjectives: ['Corduroy', 'Trucker', 'Beanie', 'Bucket', 'Dad'],
    sizes: ['One size'],
    price: [18, 38],
    tags: ['headwear', 'casual', 'accessory'],
    blurb: 'structured crown with an adjustable everyday fit',
  },
  {
    key: 'accessory',
    label: 'Accessory',
    count: 20,
    brands: ['Northline', 'Basalt', 'Vela', 'Field & Form'],
    adjectives: [
      'Canvas Tote',
      'Leather Wallet',
      'Wool Socks',
      'Steel Bottle',
      'Key Clip',
    ],
    sizes: ['One size'],
    price: [12, 60],
    tags: ['daily carry', 'gift', 'essential'],
    blurb: 'a durable everyday essential made for repeat use',
  },
]

function mulberry32(seed) {
  let value = seed
  return () => {
    value |= 0
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function roundPrice(value) {
  return Math.round(value * 100) / 100
}

rmSync(imagesDir, { recursive: true, force: true })
mkdirSync(imagesDir, { recursive: true })

const products = []
let nextId = 1

for (const category of CATEGORIES) {
  for (let index = 0; index < category.count; index += 1) {
    const id = nextId
    nextId += 1
    const random = mulberry32(id * 7919)
    const color =
      category.key === 'tshirt'
        ? COLORS[Math.floor(index / 5) % COLORS.length]
        : COLORS[index % COLORS.length]
    const brand = category.brands[index % category.brands.length]
    const adjective = category.adjectives[index % category.adjectives.length]
    const [minPrice, maxPrice] = category.price
    const price = roundPrice(
      minPrice + (maxPrice - minPrice) * (0.2 + random() * 0.8),
    )
    const name = `${brand} ${color.label} ${adjective} ${category.label}`
    const rating = Math.round((3.6 + random() * 1.4) * 10) / 10
    const stock = random() < 0.08 ? 0 : 3 + Math.floor(random() * 38)
    const sizes =
      category.key === 'tshirt' || category.key === 'hoodie'
        ? category.sizes.filter((_, sizeIndex) => sizeIndex >= index % 2)
        : category.sizes
    const slug = slugify(name)
    const image = `/products/${slug}.svg`

    products.push({
      id,
      name,
      slug,
      brand,
      category: category.key,
      color: color.key,
      sizes,
      price,
      rating: Math.min(5, rating),
      stock,
      description: `The ${name} pairs ${category.blurb} with a ${color.key} finish. Built for repeat wear and easy styling.`,
      tags: [category.key, color.key, ...category.tags],
      image,
    })

    writeFileSync(
      resolve(imagesDir, `${slug}.svg`),
      renderProductImage({
        id,
        name,
        category: category.key,
        color: color.key,
        variant: adjective,
      }),
    )
  }
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(products, null, 2)}\n`)

const summary = products.reduce((counts, product) => {
  counts[product.category] = (counts[product.category] ?? 0) + 1
  return counts
}, {})

console.log(`Wrote ${products.length} products to ${output}`)
console.log(`Wrote ${products.length} product illustrations to ${imagesDir}`)
console.log(summary)
