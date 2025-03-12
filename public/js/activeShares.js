// Define all handlers first
const handlers = {
  async deleteShare(token, button, adminKey) {
    if (!confirm("Are you sure you want to delete this share link?")) return;

    const originalIcon = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    button.disabled = true;

    try {
      const response = await fetch(`/share/${token}`, {
        credentials: "include",
        method: "DELETE",
        headers: {
          "x-admin-key": adminKey,
        },
      });

      if (!response.ok) throw new Error("Failed to delete share");

      const card = button.closest(".share-link-card");
      card.style.opacity = "0";
      setTimeout(() => {
        card.remove();
        const cards = document.querySelectorAll(".share-link-card");
        if (cards.length === 0) {
          const grid = document.querySelector(".share-links-grid");
          grid.innerHTML = `
              <div class="empty-state">
                <i class="fas fa-share-alt empty-icon"></i>
                <h3>No Active Shares</h3>
                <p>Create a share link to get started</p>
              </div>
            `;
        }
      }, 300);

      window.showToast("Share link deleted successfully");
    } catch (error) {
      console.error("Error:", error);
      window.showToast("Failed to delete share link", true);
      button.innerHTML = originalIcon;
      button.disabled = false;
    }
  },

  copyShareUrl(button) {
    const input = button.previousElementSibling;
    input.select();
    document.execCommand("copy");
    window.showToast("Link copied to clipboard!");
  },
};
