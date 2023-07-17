import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';

// Styles
import '../styles/globals.css';
import '../styles/home.css';
import '../styles/global-tailwind.css';
import '../styles/globals.scss';

export default function App({
	Component,
	pageProps: { session, ...pageProps },
}: AppProps): any {
	return (
		<SessionProvider session={session}>
			<Component {...pageProps} />
		</SessionProvider>
	);
}
