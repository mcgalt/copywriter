<?php
/**
 * Appearance → Tank Tools setup: creates the Home page, filled with the theme's patterns. Nothing happens until you press the button, and pages that
 * already exist (same slug) are left alone.
 *
 * @package tank-tools
 */

defined( 'ABSPATH' ) || exit;

function tank_tools_starter_pages() {
	return array(
		'home'       => array( 'Where does the water go?', 'Model your tank in 3D, place your pumps, outlets, airstones and rock, and see where the water flows and where it doesn\'t.', '', 'landing' ),
	);
}

add_action( 'admin_menu', function () {
	add_theme_page( 'Tank Tools setup', 'Tank Tools setup', 'edit_theme_options', 'tank-tools-setup', 'tank_tools_setup_screen' );
} );

function tank_tools_setup_screen() {
	$done = isset( $_GET['tt_done'] ) ? (int) $_GET['tt_done'] : -1; // phpcs:ignore WordPress.Security.NonceVerification
	?>
	<div class="wrap">
		<h1>Tank Tools setup</h1>
		<?php if ( $done >= 0 ) : ?>
			<div class="notice notice-success"><p><?php echo esc_html( sprintf( '%d page(s) created. Find them under Pages.', $done ) ); ?></p></div>
		<?php endif; ?>
		<p>This creates the <strong>Home</strong> page: three cards (Marine, Freshwater, Coldwater) that open the Flow Simulator. The simulator's own page (<code>/flow/</code>) is made by the Tank Flow Simulator plugin when you activate it. A page that already exists at the same address is skipped.</p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<?php wp_nonce_field( 'tank_tools_setup' ); ?>
			<input type="hidden" name="action" value="tank_tools_setup">
			<p><label><input type="checkbox" name="publish" value="1"> Publish it and make it the site's front page</label><br>
			<span class="description">Leave unticked to create it as a draft you can review first.</span></p>
			<?php submit_button( 'Create the home page' ); ?>
		</form>
	</div>
	<?php
}

add_action( 'admin_post_tank_tools_setup', function () {
	if ( ! current_user_can( 'edit_theme_options' ) ) {
		wp_die( 'Not allowed.' );
	}
	check_admin_referer( 'tank_tools_setup' );
	$publish = ! empty( $_POST['publish'] );
	$made    = 0;
	$home_id = 0;

	foreach ( tank_tools_starter_pages() as $slug => $p ) {
		list( $title, $excerpt, $template, $layout ) = $p;
		$existing = get_page_by_path( $slug );
		if ( $existing ) {
			if ( 'home' === $slug ) {
				$home_id = $existing->ID;
			}
			continue;
		}
		$content = 'landing' === $layout ? tank_tools_landing_content() : tank_tools_kind_content( $layout );
		$id      = wp_insert_post( array(
			'post_type'    => 'page',
			'post_status'  => $publish ? 'publish' : 'draft',
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_excerpt' => $excerpt,
			'post_content' => $content,
			'page_template' => $template,
		), true );
		if ( ! is_wp_error( $id ) ) {
			$made++;
			if ( 'home' === $slug ) {
				$home_id = $id;
			}
		}
	}

	if ( $publish && $home_id ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $home_id );
	}
	wp_safe_redirect( admin_url( 'themes.php?page=tank-tools-setup&tt_done=' . $made ) );
	exit;
} );
