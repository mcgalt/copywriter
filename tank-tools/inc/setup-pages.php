<?php
/**
 * Appearance → Tank Tools setup: creates the starter pages (Home, Marine, Freshwater, Coldwater)
 * filled with the theme's patterns. Nothing happens until you press the button, and pages that
 * already exist (same slug) are left alone.
 *
 * @package tank-tools
 */

defined( 'ABSPATH' ) || exit;

function tank_tools_starter_pages() {
	return array(
		'home'       => array( 'Tools for your tank', 'Track your water tests, plan your flow and lighting, and keep an eye on everything living in your tank. All free to use.', '', 'landing' ),
		'marine'     => array( 'Reef tanks', 'Plan your flow, stay on top of your tests, find the right spot for every coral and keep watch over the whole reef.', '', 'marine' ),
		'freshwater' => array( 'Freshwater tanks', 'Filter flow, water tests, light for your plants, and a check on whether your fish will get along.', 'page-kind-fresh', 'fresh' ),
		'coldwater'  => array( 'Coldwater tanks', 'Keep goldfish and other coldwater fish healthy with tools for flow, testing, plants and stocking.', 'page-kind-cold', 'cold' ),
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
		<p>This creates four starter pages built from the theme's patterns: <strong>Home</strong>, <strong>Marine</strong>, <strong>Freshwater</strong> and <strong>Coldwater</strong>. Pages that already exist with those addresses are skipped.</p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<?php wp_nonce_field( 'tank_tools_setup' ); ?>
			<input type="hidden" name="action" value="tank_tools_setup">
			<p><label><input type="checkbox" name="publish" value="1"> Publish them and make <em>Home</em> the site's front page</label><br>
			<span class="description">Leave unticked to create them as drafts you can review first.</span></p>
			<?php submit_button( 'Create starter pages' ); ?>
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
