<?php
/**
 * Title: Footer links
 * Slug: tank-tools/footer-links
 * Categories: tank-tools
 * Inserter: no
 */
?>
<!-- wp:paragraph {"fontSize":"x-small","className":"tt-foot-links"} -->
<p class="tt-foot-links has-x-small-font-size">© <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php echo esc_html( get_bloginfo( 'name' ) ); ?> · <a href="<?php echo esc_url( home_url( '/marine/' ) ); ?>">Marine</a>, <a href="<?php echo esc_url( home_url( '/freshwater/' ) ); ?>">freshwater</a> and <a href="<?php echo esc_url( home_url( '/coldwater/' ) ); ?>">coldwater</a> · <a href="<?php echo esc_url( get_privacy_policy_url() ? get_privacy_policy_url() : home_url( '/privacy-policy/' ) ); ?>">Privacy</a> · <a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>">Send feedback</a></p>
<!-- /wp:paragraph -->
