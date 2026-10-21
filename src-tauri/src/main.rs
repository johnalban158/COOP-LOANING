#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod lib;
use lib::commands::*;
use tauri_plugin_log::LoggerBuilder;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            // Auth
            login_member,
            login_officer,
            login_admin,
            complete_profile_setup,
            request_password_reset,
            reset_password_with_token,
            create_member,
            get_members,
            get_member_profile,
            create_officer_account,
            get_officer_accounts,
            update_officer_account,
            deactivate_officer_account,
            change_officer_credentials,
            get_settings,
            save_settings,
            check_spreadsheet_connected,
            // Loans
            submit_loan_application,
            get_loan_applications,
            approve_application,
            reject_application,
            final_release_loan,
            batch_release_loans,
            get_member_loans,
            get_all_loans_by_member,
            get_loan_terms,
            add_loan_direct,
            add_migration_loan,
            get_officer_borrower_data,
            get_deductions_for_member,
            add_deduction,
            remove_deduction,
            save_borrower_remarks,
            get_treasurer_release_data,
            get_deduction_settings,
            save_deduction_settings,
            // Payments
            record_payment,
            get_payments,
            get_member_payments,
            confirm_payment,
            review_payment,
            reject_payment_record,
            record_payment_by_admin,
            search_payment_by_or,
            bulk_mark_months_paid,
            submit_multi_month_payment,
            get_payments_by_loan_id,
            // Members dashboard
            get_member_dashboard_data,
            get_cbu_history,
            get_member_ledger_data,
            send_member_question,
            // AI / Nemotron
            nemotron_chat,
            nemotron_analyze_document,
            nemotron_loan_recommendation,
            // Health
            health_check,
        ])
        .run(tauri::generate_context!());
}
