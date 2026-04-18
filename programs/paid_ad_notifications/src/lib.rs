use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("8V3Q2XHk2LhM1SYwX5wP5j8QWqL2rJ5B9T1n2m3Q4xYz");

const MAX_CATEGORIES: usize = 8;
const MAX_CATEGORY_LEN: usize = 32;
const MAX_CONTENT_URI_LEN: usize = 160;

#[program]
pub mod paid_ad_notifications {
    use super::*;

    pub fn upsert_policy(
        ctx: Context<UpsertPolicy>,
        enabled: bool,
        min_fee_lamports: u64,
        max_notifications_per_period: u16,
        allowed_categories: Vec<String>,
    ) -> Result<()> {
        require!(
            allowed_categories.len() <= MAX_CATEGORIES,
            ErrorCode::TooManyCategories
        );

        for c in &allowed_categories {
            require!(!c.is_empty(), ErrorCode::InvalidCategory);
            require!(c.len() <= MAX_CATEGORY_LEN, ErrorCode::CategoryTooLong);
        }

        let policy = &mut ctx.accounts.policy;
        policy.bump = ctx.bumps.policy;
        policy.recipient_wallet = ctx.accounts.recipient.key();
        policy.enabled = enabled;
        policy.min_fee_lamports = min_fee_lamports;
        policy.max_notifications_per_period = max_notifications_per_period;
        policy.allowed_categories = allowed_categories;
        policy.updated_at_slot = Clock::get()?.slot;

        Ok(())
    }

    pub fn submit_ad_request(
        ctx: Context<SubmitAdRequest>,
        request_id: u64,
        category: String,
        content_uri_or_hash: String,
        fee_paid_lamports: u64,
    ) -> Result<()> {
        let policy = &ctx.accounts.policy;

        require!(policy.enabled, ErrorCode::PolicyDisabled);
        require!(
            fee_paid_lamports >= policy.min_fee_lamports,
            ErrorCode::FeeBelowMinimum
        );
        require!(!category.is_empty(), ErrorCode::InvalidCategory);
        require!(category.len() <= MAX_CATEGORY_LEN, ErrorCode::CategoryTooLong);
        require!(
            content_uri_or_hash.len() <= MAX_CONTENT_URI_LEN,
            ErrorCode::ContentUriTooLong
        );

        if !policy.allowed_categories.is_empty() {
            let allowed = policy
                .allowed_categories
                .iter()
                .any(|allowed| allowed == &category);
            require!(allowed, ErrorCode::CategoryNotAllowed);
        }

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
            ),
            fee_paid_lamports,
        )?;

        let request = &mut ctx.accounts.request;
        request.bump = ctx.bumps.request;
        request.request_id = request_id;
        request.recipient_wallet = ctx.accounts.recipient.key();
        request.sender_wallet = ctx.accounts.sender.key();
        request.fee_paid_lamports = fee_paid_lamports;
        request.category = category;
        request.content_uri_or_hash = content_uri_or_hash;
        request.created_at_slot = Clock::get()?.slot;
        request.status = RequestStatus::Submitted as u8;

        Ok(())
    }

    pub fn update_request_status(ctx: Context<UpdateRequestStatus>, status: u8) -> Result<()> {
        require!(status <= RequestStatus::Dismissed as u8, ErrorCode::InvalidStatus);

        let request = &mut ctx.accounts.request;
        request.status = status;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpsertPolicy<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,
    #[account(
        init_if_needed,
        payer = recipient,
        space = 8 + RecipientPolicy::INIT_SPACE,
        seeds = [b"policy", recipient.key().as_ref()],
        bump
    )]
    pub policy: Account<'info, RecipientPolicy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(request_id: u64)]
pub struct SubmitAdRequest<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(mut)]
    /// CHECK: recipient receives payment lamports directly.
    pub recipient: UncheckedAccount<'info>,

    #[account(
        seeds = [b"policy", recipient.key().as_ref()],
        bump = policy.bump,
        constraint = policy.recipient_wallet == recipient.key() @ ErrorCode::PolicyRecipientMismatch
    )]
    pub policy: Account<'info, RecipientPolicy>,

    #[account(
        init,
        payer = sender,
        space = 8 + AdNotificationRequest::INIT_SPACE,
        seeds = [
            b"request",
            recipient.key().as_ref(),
            sender.key().as_ref(),
            &request_id.to_le_bytes()
        ],
        bump
    )]
    pub request: Account<'info, AdNotificationRequest>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRequestStatus<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(
        mut,
        seeds = [b"request", request.recipient_wallet.as_ref(), request.sender_wallet.as_ref(), &request.request_id.to_le_bytes()],
        bump = request.bump,
        constraint = request.recipient_wallet == recipient.key() @ ErrorCode::UnauthorizedRecipient
    )]
    pub request: Account<'info, AdNotificationRequest>,
}

#[account]
#[derive(InitSpace)]
pub struct RecipientPolicy {
    pub bump: u8,
    pub recipient_wallet: Pubkey,
    pub enabled: bool,
    pub min_fee_lamports: u64,
    pub max_notifications_per_period: u16,
    #[max_len(MAX_CATEGORIES, MAX_CATEGORY_LEN)]
    pub allowed_categories: Vec<String>,
    pub updated_at_slot: u64,
}

#[account]
#[derive(InitSpace)]
pub struct AdNotificationRequest {
    pub bump: u8,
    pub request_id: u64,
    pub recipient_wallet: Pubkey,
    pub sender_wallet: Pubkey,
    pub fee_paid_lamports: u64,
    #[max_len(MAX_CATEGORY_LEN)]
    pub category: String,
    #[max_len(MAX_CONTENT_URI_LEN)]
    pub content_uri_or_hash: String,
    pub created_at_slot: u64,
    pub status: u8,
}

#[repr(u8)]
pub enum RequestStatus {
    Submitted = 0,
    Delivered = 1,
    Dismissed = 2,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Policy is disabled")]
    PolicyDisabled,
    #[msg("Fee paid is below recipient minimum")]
    FeeBelowMinimum,
    #[msg("Too many categories")]
    TooManyCategories,
    #[msg("Category is invalid")]
    InvalidCategory,
    #[msg("Category is too long")]
    CategoryTooLong,
    #[msg("Category not allowed by recipient policy")]
    CategoryNotAllowed,
    #[msg("Content URI/hash is too long")]
    ContentUriTooLong,
    #[msg("Invalid request status")]
    InvalidStatus,
    #[msg("Recipient in policy does not match")]
    PolicyRecipientMismatch,
    #[msg("Only recipient can update this request")]
    UnauthorizedRecipient,
}
