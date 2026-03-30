import { RssCollector } from './rss.collector.js';

// ProductHunt uses a standard RSS feed — reuse RssCollector.
export class ProductHuntCollector extends RssCollector {
  override name = 'producthunt';
}
