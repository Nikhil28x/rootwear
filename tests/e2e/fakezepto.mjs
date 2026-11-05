// Stand-in for ZeptoMail's send API: records every email as one JSON line.
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
const LOG = new URL('./mail.jsonl', import.meta.url).pathname;
createServer((req, res) => {
	let body = '';
	req.on('data', (c) => (body += c));
	req.on('end', () => {
		let json = {};
		try {
			json = JSON.parse(body);
		} catch {}
		appendFileSync(
			LOG,
			JSON.stringify({
				at: new Date().toISOString(),
				auth: (req.headers.authorization ?? '').slice(0, 24),
				...json
			}) + '\n'
		);
		res.writeHead(201, { 'content-type': 'application/json' });
		res.end(
			JSON.stringify({
				data: [{ code: 'EM_104', message: 'Email request received' }],
				request_id: 'fake-' + Date.now()
			})
		);
	});
}).listen(54399, '127.0.0.1', () => console.log('fake zeptomail on 54399'));
