use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("R5NWNg9eRLWWQU81Xbzz5Du1k7jTDeeT92Ty6qCeXet");

#[program]
pub mod corify_escrow {
    use super::*;

    pub fn deposit(
        ctx: Context<Deposit>,
        award_ref: Pubkey,
        amount_lamports: u64,
        no_delivery_deadline: i64,
    ) -> Result<()> {
        require!(amount_lamports > 0, EscrowError::ZeroAmount);
        require!(
            no_delivery_deadline > Clock::get()?.unix_timestamp,
            EscrowError::DeadlineInPast
        );

        let escrow = &mut ctx.accounts.escrow;
        escrow.buyer = ctx.accounts.buyer.key();
        escrow.seller = ctx.accounts.seller.key();
        escrow.ledger = ctx.accounts.ledger.key();
        escrow.award_ref = award_ref;
        escrow.amount_lamports = amount_lamports;
        escrow.no_delivery_deadline = no_delivery_deadline;
        escrow.bump = ctx.bumps.escrow;

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            amount_lamports,
        )?;

        Ok(())
    }

    pub fn release(ctx: Context<LedgerSettle>) -> Result<()> {
        let amount = ctx.accounts.escrow.amount_lamports;
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? = ctx
            .accounts
            .escrow
            .to_account_info()
            .lamports()
            .checked_sub(amount)
            .ok_or(EscrowError::Overflow)?;
        **ctx.accounts.seller.try_borrow_mut_lamports()? = ctx
            .accounts
            .seller
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;
        Ok(())
    }

    pub fn refund_by_ledger(_ctx: Context<LedgerRefund>) -> Result<()> {
        Ok(())
    }

    pub fn refund_after_no_delivery(ctx: Context<TimeoutRefund>) -> Result<()> {
        require!(
            Clock::get()?.unix_timestamp >= ctx.accounts.escrow.no_delivery_deadline,
            EscrowError::BeforeDeadline
        );
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(award_ref: Pubkey)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: payout destination bound into escrow.
    pub seller: UncheckedAccount<'info>,
    /// CHECK: Ledger authority allowed to release/refund after verification.
    pub ledger: UncheckedAccount<'info>,
    #[account(
        init,
        payer = buyer,
        space = 8 + CorifyEscrow::INIT_SPACE,
        seeds = [b"corify-escrow", buyer.key().as_ref(), award_ref.as_ref()],
        bump
    )]
    pub escrow: Account<'info, CorifyEscrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LedgerSettle<'info> {
    pub ledger: Signer<'info>,
    /// CHECK: buyer receives rent on close.
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,
    /// CHECK: seller must match escrow and receives settlement.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,
    #[account(
        mut,
        close = buyer,
        has_one = ledger @ EscrowError::WrongLedger,
        has_one = seller @ EscrowError::WrongSeller,
        has_one = buyer @ EscrowError::WrongBuyer,
        seeds = [b"corify-escrow", buyer.key().as_ref(), escrow.award_ref.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, CorifyEscrow>,
}

#[derive(Accounts)]
pub struct LedgerRefund<'info> {
    pub ledger: Signer<'info>,
    /// CHECK: buyer receives escrow amount and rent through close.
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,
    #[account(
        mut,
        close = buyer,
        has_one = ledger @ EscrowError::WrongLedger,
        has_one = buyer @ EscrowError::WrongBuyer,
        seeds = [b"corify-escrow", buyer.key().as_ref(), escrow.award_ref.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, CorifyEscrow>,
}

#[derive(Accounts)]
pub struct TimeoutRefund<'info> {
    /// Any signer may trigger the no-delivery timeout refund after deadline.
    pub caller: Signer<'info>,
    /// CHECK: buyer receives escrow amount and rent through close.
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,
    #[account(
        mut,
        close = buyer,
        has_one = buyer @ EscrowError::WrongBuyer,
        seeds = [b"corify-escrow", buyer.key().as_ref(), escrow.award_ref.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, CorifyEscrow>,
}

#[account]
#[derive(InitSpace)]
pub struct CorifyEscrow {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub ledger: Pubkey,
    pub award_ref: Pubkey,
    pub amount_lamports: u64,
    pub no_delivery_deadline: i64,
    pub bump: u8,
}

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Deadline must be in the future")]
    DeadlineInPast,
    #[msg("Only the bound Ledger authority may settle this escrow")]
    WrongLedger,
    #[msg("Buyer does not match the escrow")]
    WrongBuyer,
    #[msg("Seller does not match the escrow")]
    WrongSeller,
    #[msg("No-delivery refund is only available at or after the deadline")]
    BeforeDeadline,
    #[msg("Arithmetic overflow")]
    Overflow,
}
