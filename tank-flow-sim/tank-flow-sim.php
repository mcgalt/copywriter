<?php
/**
 * Plugin Name: Tank Flow Simulator
 * Description: A 3D water-flow simulator for aquariums. Put [tank_flow_sim] on any page. Setups are saved to your WordPress account.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * Text Domain: tank-flow-sim
 *
 * @package tank-flow-sim
 */

defined( 'ABSPATH' ) || exit;

const TANK_FLOW_SIM_VERSION = '1.0.0';
const TANK_FLOW_SIM_META    = 'tank_flow_sim_setups';

/**
 * [tank_flow_sim kind="marine|fresh|cold" height="72vh"]
 * kind picks the starting template when you have nothing saved yet.
 */
add_shortcode( 'tank_flow_sim', function ( $atts ) {
	$atts = shortcode_atts( array( 'kind' => 'marine', 'height' => '' ), $atts, 'tank_flow_sim' );
	$kind = in_array( $atts['kind'], array( 'marine', 'fresh', 'cold' ), true ) ? $atts['kind'] : 'marine';
	if ( isset( $_GET['kind'] ) && in_array( $_GET['kind'], array( 'marine', 'fresh', 'cold' ), true ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		$kind = sanitize_key( $_GET['kind'] ); // phpcs:ignore WordPress.Security.NonceVerification
	}
	$base = plugins_url( 'assets/', __FILE__ );
	wp_enqueue_style( 'tank-flow-sim', $base . 'style.css', array(), TANK_FLOW_SIM_VERSION );
	if ( function_exists( 'wp_enqueue_script_module' ) ) {
		wp_enqueue_script_module( 'tank-flow-sim', $base . 'app.js', array(), TANK_FLOW_SIM_VERSION );
	}
	$style = $atts['height'] ? ' style="--tfs-h:' . esc_attr( $atts['height'] ) . '"' : '';
	$rest  = is_user_logged_in() ? esc_url( rest_url( 'tank-flow/v1/setups' ) ) : '';
	$nonce = is_user_logged_in() ? esc_attr( wp_create_nonce( 'wp_rest' ) ) : '';
	return '<div class="tank-flow-sim alignwide" data-kind="' . esc_attr( $kind ) . '" data-rest="' . $rest . '" data-nonce="' . $nonce . '"' . $style . '>'
		. '<p class="tfs-loading">Loading the flow simulator…</p></div>';
} );

/* Saved setups live on your user account, so they follow you between computers. */
add_action( 'rest_api_init', function () {
	register_rest_route( 'tank-flow/v1', '/setups', array(
		array(
			'methods'             => 'GET',
			'permission_callback' => 'is_user_logged_in',
			'callback'            => function () {
				$raw  = get_user_meta( get_current_user_id(), TANK_FLOW_SIM_META, true );
				$list = $raw ? json_decode( $raw, true ) : array();
				return rest_ensure_response( is_array( $list ) ? $list : array() );
			},
		),
		array(
			'methods'             => 'POST',
			'permission_callback' => 'is_user_logged_in',
			'callback'            => function ( WP_REST_Request $req ) {
				$list = $req->get_json_params();
				if ( ! is_array( $list ) ) {
					return new WP_Error( 'tfs_bad', 'Expected a list of setups.', array( 'status' => 400 ) );
				}
				$json = wp_json_encode( array_values( $list ) );
				if ( strlen( $json ) > 500000 ) {
					return new WP_Error( 'tfs_big', 'Too much to save.', array( 'status' => 413 ) );
				}
				update_user_meta( get_current_user_id(), TANK_FLOW_SIM_META, wp_slash( $json ) );
				return rest_ensure_response( array( 'saved' => count( $list ) ) );
			},
		),
	) );
} );

/* On activation, add a "Flow Simulator" page (slug /flow/) if there isn't one. */
register_activation_hook( __FILE__, function () {
	if ( get_page_by_path( 'flow' ) ) {
		return;
	}
	wp_insert_post( array(
		'post_type'    => 'page',
		'post_status'  => 'publish',
		'post_title'   => 'Flow Simulator',
		'post_name'    => 'flow',
		'post_excerpt' => 'Place your pumps, outlets and rock in a 3D model of your tank and see where the water goes. Red shows the dead zones.',
		'post_content' => "<!-- wp:shortcode -->\n[tank_flow_sim]\n<!-- /wp:shortcode -->",
	) );
} );
