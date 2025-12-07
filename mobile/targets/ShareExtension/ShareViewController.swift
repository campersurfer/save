import UIKit
import Social
import MobileCoreServices

class ShareViewController: UIViewController {

    private let containerView = UIView()
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let activityIndicator = UIActivityIndicatorView(style: .medium)

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        handleShare()
    }

    private func setupUI() {
        // Bauhaus Dark Theme
        view.backgroundColor = UIColor(red: 0.04, green: 0.04, blue: 0.04, alpha: 0.8) // #0A0A0B with opacity
        
        containerView.backgroundColor = UIColor(red: 0.10, green: 0.10, blue: 0.11, alpha: 1.0) // #1A1A1C
        containerView.layer.cornerRadius = 16
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)
        
        titleLabel.text = "Saving to Save..."
        titleLabel.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(titleLabel)
        
        statusLabel.text = "Processing URL..."
        statusLabel.font = UIFont.systemFont(ofSize: 14)
        statusLabel.textColor = UIColor(white: 0.7, alpha: 1.0)
        statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(statusLabel)
        
        activityIndicator.color = UIColor(red: 0.0, green: 0.4, blue: 1.0, alpha: 1.0) // #0066FF
        activityIndicator.startAnimating()
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(activityIndicator)
        
        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 250),
            containerView.heightAnchor.constraint(equalTo: 150),
            
            activityIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            activityIndicator.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 30),
            
            titleLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            
            statusLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16)
        ])
    }

    private func handleShare() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem else {
            self.close()
            return
        }

        guard let itemProvider = extensionItem.attachments?.first else {
            self.close()
            return
        }

        if itemProvider.hasItemConformingToTypeIdentifier(kUTTypeURL as String) {
            itemProvider.loadItem(forTypeIdentifier: kUTTypeURL as String, options: nil) { [weak self] (item, error) in
                if let url = item as? URL {
                    self?.saveUrl(url)
                } else {
                    self?.close()
                }
            }
        } else {
            self.close()
        }
    }

    private func saveUrl(_ url: URL) {
        // Update UI on main thread
        DispatchQueue.main.async {
            self.statusLabel.text = "Saving..."
        }

        // Use App Groups to share data with main app
        // Ensure you enable App Groups in "Signing & Capabilities" for both targets
        // and add "group.com.campersurfer.save"
        let userDefaults = UserDefaults(suiteName: "group.com.campersurfer.save")
        
        // Get existing queue or create new one
        var queue = userDefaults?.array(forKey: "shared_urls") as? [String] ?? []
        queue.append(url.absoluteString)
        userDefaults?.set(queue, forKey: "shared_urls")
        userDefaults?.synchronize()
        
        // Optional: Open main app to trigger processing
        // let appUrl = URL(string: "saveapp://process-share")!
        // self.extensionContext?.open(appUrl, completionHandler: nil)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.statusLabel.text = "Saved!"
            self.activityIndicator.stopAnimating()
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.close()
            }
        }
    }

    private func close() {
        DispatchQueue.main.async {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
}
