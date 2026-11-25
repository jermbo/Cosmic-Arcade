import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import './styles/themes.css';
import './styles/base.css';
import './styles/title.css';
import './styles/game.css';
import './styles/cards.css';
import './styles/dialogs.css';
import { boot } from './ui/app.ts';
import { installSprite } from './ui/icons.ts';

installSprite();
boot();
