// The price of land: plots to buy, and rocks to clear.

/** Clearing a rock costs this times the planet's ore value, and grows with each rock cleared there. */
export const BLAST_COST = 40;
export const BLAST_GROWTH = 2.5;

/**
 * A plot costs a share of the planet's unlock price, times the planet's value.
 * Each plot bought on a planet makes its next plot cost more.
 */
export const PLOT_PRICE = {
	/** The unlock price it uses is at least this, so plots on Cinder are not free. */
	minUnlock: 400,
	share: 0.55,
	growth: 1.9,
};
