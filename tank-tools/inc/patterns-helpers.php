<?php
/**
 * Small helpers the block patterns use to build cards, so every card has the same markup.
 *
 * @package tank-tools
 */

defined( 'ABSPATH' ) || exit;

/** URL of a picture shipped with the theme (assets/img). */
function tank_tools_img( $name ) {
	return esc_url( get_theme_file_uri( 'assets/img/' . $name ) );
}

/**
 * One "kind of tank" card: photo, name, one line, and a link.
 *
 * @param string $kind  marine | fresh | cold (sets the link colour).
 * @param string $title Card heading.
 * @param string $text  One-line description.
 * @param string $href  Where the card goes.
 * @param string $img   Picture file in assets/img.
 * @param string $alt   Picture description.
 * @param string $go    Link text.
 */
function tank_tools_kind_card( $kind, $title, $text, $href, $img, $alt, $go = 'Open the simulator' ) {
	$src = tank_tools_img( $img );
	return '<!-- wp:group {"className":"tt-card tt-k-' . $kind . '","layout":{"type":"default"}} -->
<div class="wp-block-group tt-card tt-k-' . $kind . '">
<!-- wp:image {"aspectRatio":"16/10","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"tt-photo"} -->
<figure class="wp-block-image size-full tt-photo"><img src="' . $src . '" alt="' . esc_attr( $alt ) . '" style="aspect-ratio:16/10;object-fit:cover"/></figure>
<!-- /wp:image -->
<!-- wp:group {"className":"tt-body","layout":{"type":"default"}} -->
<div class="wp-block-group tt-body">
<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">' . esc_html( $title ) . '</h3>
<!-- /wp:heading -->
<!-- wp:paragraph {"className":"tt-muted"} -->
<p class="tt-muted">' . esc_html( $text ) . '</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"className":"tt-go"} -->
<p class="tt-go"><a href="' . esc_url( $href ) . '">' . esc_html( $go ) . '</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->';
}

/**
 * One tool card: a screenshot in a dark frame, name (with an optional badge), description and link.
 *
 * @param string $title Tool name.
 * @param string $text  What it does.
 * @param string $href  Link to the tool's page.
 * @param string $img   Screenshot file in assets/img.
 * @param string $state '' (normal), 'pro' (Pro badge) or 'soon' (greyed out, Coming soon, no link).
 */
function tank_tools_tool_card( $title, $text, $href, $img, $state = '' ) {
	$src   = tank_tools_img( $img );
	$soon  = 'soon' === $state;
	$class = 'tt-card tt-tool' . ( $soon ? ' is-soon' : '' );
	$badge = 'pro' === $state ? '
<!-- wp:paragraph {"className":"tt-badge"} -->
<p class="tt-badge">Pro</p>
<!-- /wp:paragraph -->' : '';
	$tag   = $soon ? '
<!-- wp:paragraph {"className":"tt-soon-tag"} -->
<p class="tt-soon-tag">Coming soon</p>
<!-- /wp:paragraph -->' : '';
	$go    = $soon
		? '<!-- wp:paragraph {"className":"tt-go"} -->
<p class="tt-go">Coming soon</p>
<!-- /wp:paragraph -->'
		: '<!-- wp:paragraph {"className":"tt-go"} -->
<p class="tt-go"><a href="' . esc_url( $href ) . '">Open ' . esc_html( $title ) . '</a></p>
<!-- /wp:paragraph -->';

	return '<!-- wp:group {"className":"' . $class . '","layout":{"type":"default"}} -->
<div class="wp-block-group ' . $class . '">
<!-- wp:group {"className":"tt-frame","layout":{"type":"default"}} -->
<div class="wp-block-group tt-frame">
<!-- wp:image {"aspectRatio":"16/10","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"tt-shot"} -->
<figure class="wp-block-image size-full tt-shot"><img src="' . $src . '" alt="' . esc_attr( 'Screenshot of ' . $title ) . '" style="aspect-ratio:16/10;object-fit:cover"/></figure>
<!-- /wp:image -->' . $tag . '
</div>
<!-- /wp:group -->
<!-- wp:group {"className":"tt-body","layout":{"type":"default"}} -->
<div class="wp-block-group tt-body">
<!-- wp:group {"className":"tt-title-row","style":{"spacing":{"blockGap":"8px"}},"layout":{"type":"flex","flexWrap":"wrap"}} -->
<div class="wp-block-group tt-title-row">
<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">' . esc_html( $title ) . '</h3>
<!-- /wp:heading -->' . $badge . '
</div>
<!-- /wp:group -->
<!-- wp:paragraph {"className":"tt-muted"} -->
<p class="tt-muted">' . esc_html( $text ) . '</p>
<!-- /wp:paragraph -->
' . $go . '
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->';
}

/** A grid wrapper for cards. $cols = 3 for kind cards, 2 for tools. */
function tank_tools_grid( $cards, $cols = 2 ) {
	return '<!-- wp:group {"className":"tt-grid tt-cols-' . (int) $cols . '","layout":{"type":"grid","columnCount":' . (int) $cols . ',"minimumColumnWidth":"260px"}} -->
<div class="wp-block-group tt-grid tt-cols-' . (int) $cols . '">
' . implode( "\n", $cards ) . '
</div>
<!-- /wp:group -->';
}

/** Section heading with an optional muted intro line. */
function tank_tools_heading( $text, $intro = '' ) {
	$out = '<!-- wp:heading {"className":"tt-section"} -->
<h2 class="wp-block-heading tt-section">' . esc_html( $text ) . '</h2>
<!-- /wp:heading -->';
	if ( $intro ) {
		$out .= '
<!-- wp:paragraph {"className":"tt-intro"} -->
<p class="tt-intro">' . esc_html( $intro ) . '</p>
<!-- /wp:paragraph -->';
	}
	return $out;
}

/**
 * The tool cards for one kind of tank, in the theme's own wording.
 * Links point to /tools/<slug>/ pages; change them in the editor once your tools exist.
 *
 * @param string $kind marine | fresh | cold.
 */
function tank_tools_kind_tools( $kind ) {
	$t = array(
		'marine' => array(
			array( 'Flow Planner', 'Place your pumps and rockwork in a 3D model of the tank and spot the dead zones where water barely moves.', 'flow', 'tool-flow.svg', '' ),
			array( 'Water Tests', 'Record alkalinity, calcium, salinity and more, see the trend at a glance and get a nudge when something swings too fast.', 'tests', 'tool-log.svg', '' ),
			array( 'Light & PAR', 'Choose your fixture and see an estimate of PAR across the tank, so each coral goes where it will thrive.', 'light', 'tool-light.svg', '' ),
			array( 'Tank Health', 'Keep a list of your livestock, run quick check-ups and get one score that weighs water, light and flow together.', 'health', 'tool-health.svg', '' ),
			array( 'Calendar', 'Schedule water changes, dosing, feeding and tests, then tick them off as you go. Each job repeats on its own timetable.', 'calendar', 'tool-calendar.svg', '' ),
			array( 'Coral Photos', 'Take coral pictures without the blue cast, so the true colours and fluorescence come through.', 'photos', 'tool-camera.svg', '' ),
			array( 'Community', 'Show off your reef, ask other reefkeepers for advice and share the gear behind your setup.', '', 'kind-marine.svg', 'soon' ),
		),
		'fresh'  => array(
			array( 'Flow Planner', 'Model your filter outlet, hardscape and airstones in 3D and see where water moves and where waste settles.', 'flow', 'tool-flow.svg', '' ),
			array( 'Water Tests', 'Log pH, KH, GH, ammonia, nitrite and nitrate, follow the trends, and follow a step-by-step guide to cycling.', 'tests', 'tool-log.svg', '' ),
			array( 'Plant Lighting', 'See how much light reaches the substrate and whether your tank suits low, medium or high-light plants.', 'light', 'tool-light.svg', '' ),
			array( 'Tank Health', 'List fish, shrimp, snails and plants. It flags tankmates that clash and shoals that are too small.', 'health', 'tool-health.svg', '' ),
			array( 'Calendar', 'Schedule water changes, ferts, feeding and tests, then tick them off as you go. Each job repeats on its own timetable.', 'calendar', 'tool-calendar.svg', '' ),
			array( 'Community', 'Share your aquascape, trade planting and stocking ideas and ask other keepers for help.', '', 'kind-fresh.svg', 'soon' ),
		),
		'cold'   => array(
			array( 'Flow Planner', 'Goldfish are messy. Model your filter and airstone in 3D and make sure water reaches every corner.', 'flow', 'tool-flow.svg', '' ),
			array( 'Water Tests', 'Log your results and temperature, watch the trends and follow a guide to cycling a new tank.', 'tests', 'tool-log.svg', '' ),
			array( 'Plant Lighting', 'Planning coldwater plants? Check how much light reaches the bottom, from elodea to moss balls.', 'light', 'tool-light.svg', '' ),
			array( 'Tank Health', 'List your fish, snails and plants. It checks tank size, temperature and which tankmates could end up as a snack.', 'health', 'tool-health.svg', '' ),
			array( 'Calendar', 'Schedule water changes, feeding and tests, then tick them off as you go. Each job repeats on its own timetable.', 'calendar', 'tool-calendar.svg', '' ),
			array( 'Community', 'Share your goldfish and pond-style tanks, ask questions and swap tips with other keepers.', '', 'kind-cold.svg', 'soon' ),
		),
	);
	$cards = array();
	foreach ( $t[ $kind ] as $row ) {
		list( $title, $text, $slug, $img, $state ) = $row;
		$cards[] = tank_tools_tool_card( $title, $text, $slug ? home_url( '/tools/' . $slug . '/' ) : '', $img, $state );
	}
	return tank_tools_grid( $cards, 2 );
}

/** Full page body for the landing page. */
function tank_tools_landing_content() {
	return tank_tools_heading( 'What do you keep?', 'Pick one to open the flow simulator with a starting setup for that kind of tank. Your saved tanks are there too.' )
		. "\n" . tank_tools_grid( array(
			tank_tools_kind_card( 'marine', 'Marine', 'Reef and fish-only tanks: corals, fish and inverts.', home_url( '/flow/?kind=marine' ), 'kind-marine.svg', 'Fish swimming over a coral reef' ),
			tank_tools_kind_card( 'fresh', 'Freshwater', 'Tropical community, planted and shrimp tanks.', home_url( '/flow/?kind=fresh' ), 'kind-fresh.svg', 'A small tropical fish among plants' ),
			tank_tools_kind_card( 'cold', 'Coldwater', 'Goldfish, minnows and other unheated setups.', home_url( '/flow/?kind=cold' ), 'kind-cold.svg', 'A fancy goldfish' ),
		), 3 );
}

/** Full page body for one kind's home page. */
function tank_tools_kind_content( $kind ) {
	ob_start();
	include get_theme_file_path( 'patterns/account-cta.php' );
	$cta = ob_get_clean();
	return $cta . "\n" . tank_tools_heading( 'The tools' ) . "\n" . tank_tools_kind_tools( $kind )
		. "\n" . '<!-- wp:pattern {"slug":"tank-tools/maker-note"} /-->';
}
