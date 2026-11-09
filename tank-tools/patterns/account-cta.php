<?php
/**
 * Title: Your tanks / create an account box
 * Slug: tank-tools/account-cta
 * Categories: tank-tools
 * Description: "Your tanks" heading with a small sign-up card and button.
 */
?>
<!-- wp:heading {"className":"tt-section"} -->
<h2 class="wp-block-heading tt-section">Your tanks</h2>
<!-- /wp:heading -->
<!-- wp:group {"className":"tt-card tt-cta","layout":{"type":"default"}} -->
<div class="wp-block-group tt-card tt-cta">
<!-- wp:paragraph {"className":"tt-muted"} -->
<p class="tt-muted"><strong>Make a free account</strong> to save your tank. Your details stay backed up and follow you to every device.</p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"className":"tt-muted"} -->
<p class="tt-muted">Just browsing? Every tool below opens with an example tank.</p>
<!-- /wp:paragraph -->
<!-- wp:buttons -->
<div class="wp-block-buttons">
<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( wp_registration_url() ); ?>">Create your free account</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
</div>
<!-- /wp:group -->
