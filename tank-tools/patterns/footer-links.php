<?php
/**
 * Title: Footer links
 * Slug: tank-tools/footer-links
 * Categories: tank-tools
 * Inserter: no
 */
?>
<!-- wp:paragraph {"fontSize":"x-small","className":"tt-foot-links"} -->
<p class="tt-foot-links has-x-small-font-size">© <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php echo esc_html( get_bloginfo( 'name' ) ); ?> · <a href="<?php echo esc_url( home_url( '/flow/' ) ); ?>">Flow Simulator</a></p>
<!-- /wp:paragraph -->
