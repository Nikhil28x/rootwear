export function load({ setHeaders }) {
	setHeaders({ 'cache-control': 'no-store' });
	return { serverNow: Date.now() };
}
