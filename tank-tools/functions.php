<?php
/**
 * Tank Tools theme setup.
 *
 * @package tank-tools
 */

defined( 'ABSPATH' ) || exit;

require_once get_theme_file_path( 'inc/patterns-helpers.php' );
require_once get_theme_file_path( 'inc/setup-pages.php' );

add_action( 'after_setup_theme', function () {
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'editor-styles' );
	add_editor_style( 'assets/css/theme.css' );
	// The short intro under each page's title in the dark header is the page's excerpt.
	add_post_type_support( 'page', 'excerpt' );
} );

add_action( 'wp_enqueue_scripts', function () {
	$ver = wp_get_theme()->get( 'Version' );
	wp_enqueue_style( 'tank-tools', get_theme_file_uri( 'assets/css/theme.css' ), array(), $ver );
} );

/* Freshwater and Coldwater pages get their own colour (green / orange), picked with the page's template. */
add_filter( 'body_class', function ( $classes ) {
	if ( is_page() ) {
		$tpl = get_page_template_slug();
		if ( 'page-kind-fresh' === $tpl ) {
			$classes[] = 'tt-kind-fresh';
		} elseif ( 'page-kind-cold' === $tpl ) {
			$classes[] = 'tt-kind-cold';
		}
	}
	if ( is_front_page() ) {
		$classes[] = 'tt-landing';
	}
	return $classes;
} );

add_action( 'init', function () {
	register_block_pattern_category( 'tank-tools', array( 'label' => __( 'Tank Tools', 'tank-tools' ) ) );
	register_block_pattern_category( 'tank-tools-pages', array( 'label' => __( 'Tank Tools: full pages', 'tank-tools' ) ) );
} );

/* Theme favicon until a Site Icon is set in Settings → General. */
add_action( 'wp_head', function () {
	if ( ! has_site_icon() ) {
		echo '<link rel="icon" href="' . esc_url( get_theme_file_uri( 'assets/img/icon.svg' ) ) . '" type="image/svg+xml">' . "\n";
	}
	echo '<meta name="theme-color" content="#082238">' . "\n";
} );

/* Show the theme's wave icon in the header until you upload your own logo (Site Editor → Header → Logo). */
add_filter( 'render_block_core/site-logo', function ( $html ) {
	if ( '' !== trim( $html ) ) {
		return $html;
	}
	return '<div class="wp-block-site-logo"><a href="' . esc_url( home_url( '/' ) ) . '" rel="home"><img src="'
		. esc_url( get_theme_file_uri( 'assets/img/icon.svg' ) ) . '" width="44" height="44" alt=""></a></div>';
} );
